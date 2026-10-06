-- Alertas de saldo bajo (spec: docs/superpowers/specs/2026-10-06-alertas-saldo-bajo-design.md).
-- revisar_alertas_saldo() mide el uso de cada tope de material y del presupuesto en dinero
-- de los proyectos activos, avisa una vez al cruzar 80 % y 100 % y se re-arma 5 puntos por debajo.
-- Pensada para pg_cron (0046): corre SIN usuario, así que se identifica como un acceso_total solo dentro de su
-- transacción para que las vistas de saldo (0035, filtradas por puede_acceder_obra) devuelvan filas sin duplicar su fórmula.
begin;

create table public.alertas_saldo (
  id             uuid primary key default gen_random_uuid(),
  obra_id        uuid not null references public.obras(id) on delete cascade,
  material_id    uuid references public.catalogo_materiales(id) on delete cascade,  -- null = presupuesto
  tipo           text not null check (tipo in ('material','presupuesto')),
  nivel          smallint not null check (nivel in (80,100)),
  uso_pct        numeric(6,2) not null,
  emitida_en     timestamptz not null default now(),
  resuelta_en    timestamptz,
  check ((tipo = 'material') = (material_id is not null))
);
-- Una sola alerta ACTIVA por clave (obra, material|presupuesto, nivel).
create unique index alertas_saldo_activa_uidx on public.alertas_saldo
  (obra_id, coalesce(material_id, '00000000-0000-0000-0000-000000000000'::uuid), tipo, nivel)
  where resuelta_en is null;
alter table public.alertas_saldo enable row level security;
revoke all on public.alertas_saldo from public, anon, authenticated;

create function public.revisar_alertas_saldo()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin    uuid;
  v_emitidas integer := 0;
  v_m        record;
  v_actual   smallint;
  v_nivel    smallint;
  v_roles    rol_usuario[];
  v_titulo   text;
  v_mensaje  text;
begin
  select id into v_admin from usuarios where rol = 'acceso_total' and activo order by creado_en limit 1;
  if v_admin is null then
    raise notice 'revisar_alertas_saldo: no hay un usuario acceso_total activo; no se revisó nada.';
    return 0;
  end if;
  -- Local a la transacción: auth.uid() devuelve este usuario y puede_acceder_obra() deja pasar.
  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  drop table if exists pg_temp._medidas;
  create temp table _medidas (
    tipo text, obra_id uuid, material_id uuid, uso numeric,
    obra_nombre text, material_nombre text, unidad text, consumido numeric, capacidad numeric
  );

  -- Material: capacidad = asignado + entradas - salidas; consumido = capacidad - disponible (en proceso + comprado).
  insert into _medidas
  select 'material', s.obra_id, s.material_id,
         case when cap <= 0 then 100 else least(999, round(cons / cap * 100, 2)) end,
         o.nombre, c.nombre_base, c.unidad_medida, cons, cap
    from v_saldo_material_obra s
    join obras o on o.id = s.obra_id and o.estado = 'activa'
    join catalogo_materiales c on c.id = s.material_id
    cross join lateral (select s.cantidad_asignada + s.traspasos_entrada - s.traspasos_salida as cap) k1
    cross join lateral (select k1.cap - s.cantidad_disponible as cons) k2
   where k1.cap > 0 or k2.cons > 0;

  -- Dinero: uso = (comprometido + gastado) / presupuesto. Presupuesto 0 con uso cuenta como 100; sin uso se omite.
  insert into _medidas
  select 'presupuesto', p.obra_id, null,
         case when p.presupuesto_mxn <= 0 then 100 else least(999, round(u.usado / p.presupuesto_mxn * 100, 2)) end,
         o.nombre, null, null, u.usado, p.presupuesto_mxn
    from v_saldo_presupuesto_obra p
    join obras o on o.id = p.obra_id and o.estado = 'activa'
    cross join lateral (select p.comprometido_mxn + p.gastado_mxn as usado) u
   where p.presupuesto_mxn > 0 or u.usado > 0;

  -- Re-armado (histéresis de 5 puntos) y limpieza (proyecto no activo o sin medición).
  update alertas_saldo a set resuelta_en = now()
   where a.resuelta_en is null
     and (not exists (select 1 from _medidas m where m.tipo = a.tipo and m.obra_id = a.obra_id
                       and m.material_id is not distinct from a.material_id)
          or exists (select 1 from _medidas m where m.tipo = a.tipo and m.obra_id = a.obra_id
                      and m.material_id is not distinct from a.material_id and m.uso < a.nivel - 5));

  -- Emisión: una fila por nivel cruzado sin alerta activa; aviso solo del nivel más alto alcanzado.
  for v_m in select * from _medidas where uso >= 80 loop
    v_actual := case when v_m.uso >= 100 then 100 else 80 end;
    foreach v_nivel in array array[80, 100]::smallint[] loop
      continue when v_nivel > v_actual;
      continue when exists (select 1 from alertas_saldo a
                             where a.resuelta_en is null and a.tipo = v_m.tipo and a.obra_id = v_m.obra_id
                               and a.material_id is not distinct from v_m.material_id and a.nivel = v_nivel);
      insert into alertas_saldo(obra_id, material_id, tipo, nivel, uso_pct)
      values (v_m.obra_id, v_m.material_id, v_m.tipo, v_nivel, v_m.uso);
      continue when v_nivel <> v_actual;

      if v_m.tipo = 'material' then
        v_roles := array['compras', 'operacion', 'acceso_total']::rol_usuario[];
        v_titulo := case v_nivel when 80 then 'Material al 80 % del tope' else 'Material en su tope' end;
        v_mensaje := case v_nivel
          when 80 then format('%s: %s lleva el %s %% de su tope (%s de %s %s).',
                              v_m.obra_nombre, v_m.material_nombre, round(v_m.uso), trim_scale(round(v_m.consumido, 2)),
                              trim_scale(round(v_m.capacidad, 2)), v_m.unidad)
          else format('%s: %s alcanzó o rebasó su tope (%s de %s %s). Para pedir más hay que ampliar el tope o traspasar.',
                      v_m.obra_nombre, v_m.material_nombre, trim_scale(round(v_m.consumido, 2)),
                      trim_scale(round(v_m.capacidad, 2)), v_m.unidad)
        end;
      else
        v_roles := array['finanzas', 'operacion', 'acceso_total']::rol_usuario[];
        v_titulo := case v_nivel when 80 then 'Presupuesto al 80 %' else 'Presupuesto agotado' end;
        v_mensaje := case v_nivel
          when 80 then format('%s: el presupuesto lleva el %s %% entre comprometido y gastado (%s de %s).',
                              v_m.obra_nombre, round(v_m.uso), to_char(v_m.consumido, 'FM$999,999,999,990.00'),
                              to_char(v_m.capacidad, 'FM$999,999,999,990.00'))
          else format('%s: el presupuesto alcanzó o rebasó el 100 %% entre comprometido y gastado (%s de %s).',
                      v_m.obra_nombre, to_char(v_m.consumido, 'FM$999,999,999,990.00'),
                      to_char(v_m.capacidad, 'FM$999,999,999,990.00'))
        end;
      end if;
      insert into notificaciones(rol_destino, titulo, mensaje, tipo, referencia_id)
      select r, v_titulo, v_mensaje, 'alerta_saldo_' || v_m.tipo, v_m.obra_id from unnest(v_roles) r;
      v_emitidas := v_emitidas + array_length(v_roles, 1);
    end loop;
  end loop;

  drop table if exists pg_temp._medidas;
  return v_emitidas;
end;
$$;

-- Solo postgres (dueño y quien ejecuta el cron). service_role no existe en el fixture local de pruebas.
revoke all on function public.revisar_alertas_saldo() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'revoke all on function public.revisar_alertas_saldo() from service_role';
  end if;
end $$;

commit;
