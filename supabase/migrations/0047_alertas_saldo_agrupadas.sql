-- Alertas de saldo (0045): agrupa los avisos de MATERIAL por proyecto y nivel en cada revisión, para que un
-- proyecto con muchos materiales no inunde la campanita (40 materiales = 3 avisos, uno por rol, no 120).
-- El estado sigue siendo por material (alertas_saldo): no cambia cuándo se emite, se re-arma ni se resuelve.
-- Además: el uso ya no se redondea antes de comparar con 80/100 (99,999 % ya no cuenta como 100 %) y los
-- textos muestran el porcentaje truncado (99 %), no redondeado.
-- create or replace conserva los permisos de 0045 (solo postgres puede ejecutarla).
begin;

create or replace function public.revisar_alertas_saldo()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin    uuid;
  v_emitidas integer := 0;
  v_m        record;
  v_g        record;
  v_actual   smallint;
  v_nivel    smallint;
  v_roles    rol_usuario[];
  v_titulo   text;
  v_mensaje  text;
  v_lista    text;
begin
  select id into v_admin from usuarios where rol = 'acceso_total' and activo order by creado_en limit 1;
  if v_admin is null then
    raise notice 'revisar_alertas_saldo: no hay un usuario acceso_total activo; no se revisó nada.';
    return 0;
  end if;
  -- Local a la transacción: auth.uid() devuelve este usuario y puede_acceder_obra() deja pasar.
  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  drop table if exists pg_temp._medidas;
  drop table if exists pg_temp._avisos;
  create temp table _medidas (
    tipo text, obra_id uuid, material_id uuid, uso numeric,
    obra_nombre text, material_nombre text, unidad text, consumido numeric, capacidad numeric
  );
  create temp table _avisos (
    obra_id uuid, obra_nombre text, nivel smallint, material_nombre text,
    unidad text, uso numeric, consumido numeric, capacidad numeric
  );

  -- Material: capacidad = asignado + entradas - salidas; consumido = capacidad - disponible (en proceso + comprado).
  insert into _medidas
  select 'material', s.obra_id, s.material_id,
         case when cap <= 0 then 100 else least(999, cons / cap * 100) end,
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
         case when p.presupuesto_mxn <= 0 then 100 else least(999, u.usado / p.presupuesto_mxn * 100) end,
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
  -- Presupuesto avisa en el acto (ya es uno por proyecto); material se junta en _avisos para agrupar.
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
        insert into _avisos values (v_m.obra_id, v_m.obra_nombre, v_nivel, v_m.material_nombre,
                                    v_m.unidad, v_m.uso, v_m.consumido, v_m.capacidad);
      else
        v_roles := array['finanzas', 'operacion', 'acceso_total']::rol_usuario[];
        v_titulo := case v_nivel when 80 then 'Presupuesto al 80 %' else 'Presupuesto agotado' end;
        v_mensaje := case v_nivel
          when 80 then format('%s: el presupuesto lleva el %s %% entre comprometido y gastado (%s de %s).',
                              v_m.obra_nombre, floor(v_m.uso), to_char(v_m.consumido, 'FM$999,999,999,990.00'),
                              to_char(v_m.capacidad, 'FM$999,999,999,990.00'))
          else format('%s: el presupuesto alcanzó o rebasó el 100 %% entre comprometido y gastado (%s de %s).',
                      v_m.obra_nombre, to_char(v_m.consumido, 'FM$999,999,999,990.00'),
                      to_char(v_m.capacidad, 'FM$999,999,999,990.00'))
        end;
        insert into notificaciones(rol_destino, titulo, mensaje, tipo, referencia_id)
        select r, v_titulo, v_mensaje, 'alerta_saldo_presupuesto', v_m.obra_id from unnest(v_roles) r;
        v_emitidas := v_emitidas + array_length(v_roles, 1);
      end if;
    end loop;
  end loop;

  -- Material: un aviso por proyecto y nivel. Un solo material conserva el texto individual con cantidades.
  v_roles := array['compras', 'operacion', 'acceso_total']::rol_usuario[];
  for v_g in
    select obra_id, obra_nombre, nivel, count(*)::integer as n,
           array_agg(material_nombre order by material_nombre) as nombres,
           min(unidad) as unidad, min(uso) as uso, min(consumido) as consumido, min(capacidad) as capacidad
      from _avisos group by obra_id, obra_nombre, nivel order by obra_id, nivel
  loop
    if v_g.n = 1 then
      v_titulo := case v_g.nivel when 80 then 'Material al 80 % del tope' else 'Material en su tope' end;
      v_mensaje := case v_g.nivel
        when 80 then format('%s: %s lleva el %s %% de su tope (%s de %s %s).',
                            v_g.obra_nombre, v_g.nombres[1], floor(v_g.uso), trim_scale(round(v_g.consumido, 2)),
                            trim_scale(round(v_g.capacidad, 2)), v_g.unidad)
        else format('%s: %s alcanzó o rebasó su tope (%s de %s %s). Para pedir más hay que ampliar el tope o traspasar.',
                    v_g.obra_nombre, v_g.nombres[1], trim_scale(round(v_g.consumido, 2)),
                    trim_scale(round(v_g.capacidad, 2)), v_g.unidad)
      end;
    else
      v_lista := array_to_string(v_g.nombres[1:5], ', ')
                 || case when v_g.n > 5 then format(' y %s más', v_g.n - 5) else '' end;
      v_titulo := case v_g.nivel when 80 then format('%s materiales al 80 %% del tope', v_g.n)
                                 else format('%s materiales en su tope', v_g.n) end;
      v_mensaje := case v_g.nivel
        when 80 then format('%s: %s llevan el 80 %% o más de su tope.', v_g.obra_nombre, v_lista)
        else format('%s: %s alcanzaron o rebasaron su tope. Para pedir más hay que ampliar el tope o traspasar.',
                    v_g.obra_nombre, v_lista)
      end;
    end if;
    insert into notificaciones(rol_destino, titulo, mensaje, tipo, referencia_id)
    select r, v_titulo, v_mensaje, 'alerta_saldo_material', v_g.obra_id from unnest(v_roles) r;
    v_emitidas := v_emitidas + array_length(v_roles, 1);
  end loop;

  drop table if exists pg_temp._avisos;
  drop table if exists pg_temp._medidas;
  return v_emitidas;
end;
$$;

commit;
