-- =====================================================================
-- MIGRACIÓN 0007 — Flujo requisiciones: Thalía → Blanquita, reservas, OC
-- Requiere 0006 y 0006a aplicadas. Revisar antes de remoto.
-- =====================================================================

-- Extender SELECT de movimientos de presupuesto para finanzas
drop policy if exists obra_presupuesto_movimientos_select on obra_presupuesto_movimientos;
create policy obra_presupuesto_movimientos_select on obra_presupuesto_movimientos
    for select using (
        auth_rol() in (
            'compras', 'finanzas', 'proyectos', 'operacion', 'acceso_total', 'personal'
        )
    );

-- Remap de estados legacy → nuevo flujo.
-- Se desactiva el trigger de permisos mientras dura el remap: ese trigger
-- exige un rol válido vía auth_rol(), que es null cuando la migración corre
-- como postgres/superusuario desde el SQL Editor (sin sesión de usuario),
-- así que sin este disable/enable el UPDATE queda bloqueado por el propio
-- trigger de la tabla que está migrando.
alter table solicitudes_material disable trigger trg_solicitudes_material_before_update;

update solicitudes_material set estado = 'recibida' where estado = 'pendiente';
update solicitudes_material set estado = 'en_proceso' where estado = 'en_cotizacion';
update solicitudes_material set estado = 'finalizada' where estado = 'aprobada';

alter table solicitudes_material enable trigger trg_solicitudes_material_before_update;

alter table solicitudes_material
    alter column estado set default 'recibida';

-- Ítems: tipología y montos (material_id opcional según tipo)
alter table solicitud_items
    add column if not exists tipo_linea tipo_linea_solicitud not null default 'material',
    add column if not exists descripcion text,
    add column if not exists monto_mxn numeric(14,2) check (monto_mxn is null or monto_mxn >= 0);

alter table solicitud_items
    alter column material_id drop not null;

alter table solicitud_items
    alter column cantidad_solicitada drop not null;

alter table solicitud_items
    drop constraint if exists solicitud_items_solicitud_id_material_id_key;

-- Cantidad > 0 solo cuando aplica
alter table solicitud_items
    drop constraint if exists solicitud_items_cantidad_solicitada_check;

alter table solicitud_items
    add constraint solicitud_items_cantidad_solicitada_check
    check (cantidad_solicitada is null or cantidad_solicitada > 0);

alter table solicitud_items
    drop constraint if exists solicitud_items_tipo_coherente_check;

alter table solicitud_items
    add constraint solicitud_items_tipo_coherente_check
    check (
        (
            tipo_linea = 'material'
            and material_id is not null
            and cantidad_solicitada is not null
            and cantidad_solicitada > 0
        )
        or (
            tipo_linea <> 'material'
            and material_id is null
            and descripcion is not null
            and length(trim(descripcion)) > 0
            and monto_mxn is not null
            and monto_mxn > 0
        )
    );

-- Unique parcial: un material no se repite por solicitud
create unique index if not exists solicitud_items_solicitud_material_uidx
    on solicitud_items (solicitud_id, material_id)
    where material_id is not null;

-- Reservas de cantidad por material
create table solicitud_reservas_cantidad (
    id              uuid primary key default gen_random_uuid(),
    solicitud_id    uuid not null references solicitudes_material(id) on delete cascade,
    obra_id         uuid not null references obras(id) on delete cascade,
    material_id     uuid not null references catalogo_materiales(id),
    cantidad        numeric(12,2) not null check (cantidad > 0),
    estado          text not null default 'activa'
                        check (estado in ('activa', 'aplicada', 'liberada')),
    creado_en       timestamptz not null default now(),
    unique (solicitud_id, material_id)
);

create index idx_solicitud_reservas_cantidad_obra
    on solicitud_reservas_cantidad(obra_id);

alter table solicitud_reservas_cantidad enable row level security;

create policy solicitud_reservas_cantidad_select on solicitud_reservas_cantidad
    for select using (
        auth_rol() in (
            'compras', 'finanzas', 'proyectos', 'operacion', 'acceso_total', 'personal'
        )
    );

create trigger trg_auditoria_solicitud_reservas_cantidad
    after insert or update or delete on solicitud_reservas_cantidad
    for each row execute function fn_auditoria();

-- OC puede nacer desde solicitud (sin cotización)
alter table ordenes_compra
    alter column cotizacion_id drop not null;

alter table ordenes_compra
    alter column proveedor_id drop not null;

alter table ordenes_compra
    add column if not exists solicitud_id uuid references solicitudes_material(id);

create index if not exists idx_ordenes_compra_solicitud on ordenes_compra(solicitud_id);

alter table orden_compra_items
    alter column material_id drop not null;

alter table orden_compra_items
    add column if not exists descripcion text,
    add column if not exists tipo_linea tipo_linea_solicitud not null default 'material';

-- Vista saldo material: contratado - reservado activo - gastado (reservas aplicadas)
create or replace view v_saldo_material_obra
with (security_invoker = true)
as
select
    omc.obra_id,
    omc.material_id,
    cm.nombre_base,
    cm.variante,
    cm.unidad_medida,
    omc.cantidad_contratada,
    coalesce((
        select sum(r.cantidad)
        from solicitud_reservas_cantidad r
        where r.obra_id = omc.obra_id
          and r.material_id = omc.material_id
          and r.estado = 'aplicada'
    ), 0)::numeric as cantidad_usada,
    (
        omc.cantidad_contratada
        - coalesce((
            select sum(r.cantidad)
            from solicitud_reservas_cantidad r
            where r.obra_id = omc.obra_id
              and r.material_id = omc.material_id
              and r.estado in ('activa', 'aplicada')
        ), 0)
    )::numeric(12,2) as cantidad_disponible,
    coalesce((
        select sum(r.cantidad)
        from solicitud_reservas_cantidad r
        where r.obra_id = omc.obra_id
          and r.material_id = omc.material_id
          and r.estado = 'activa'
    ), 0)::numeric as cantidad_comprometida
from obra_material_contratado omc
join catalogo_materiales cm on cm.id = omc.material_id;

grant select on v_saldo_material_obra to authenticated;

-- Políticas SELECT ampliadas (finanzas)
drop policy if exists solicitudes_material_select on solicitudes_material;
create policy solicitudes_material_select on solicitudes_material for select
    using (
        solicitante_id = auth.uid()
        or auth_rol() in (
            'compras', 'finanzas', 'proyectos', 'operacion', 'acceso_total'
        )
    );

drop policy if exists solicitud_items_select on solicitud_items;
create policy solicitud_items_select on solicitud_items for select
    using (
        exists (
            select 1 from solicitudes_material sm
            where sm.id = solicitud_items.solicitud_id
              and (
                  sm.solicitante_id = auth.uid()
                  or auth_rol() in (
                      'compras', 'finanzas', 'proyectos', 'operacion', 'acceso_total'
                  )
              )
        )
    );

-- Insert de items con estado recibida (antes pendiente)
drop policy if exists solicitud_items_insert on solicitud_items;
create policy solicitud_items_insert on solicitud_items for insert
    with check (
        exists (
            select 1 from solicitudes_material sm
            where sm.id = solicitud_items.solicitud_id
              and sm.estado = 'recibida'
              and (
                  sm.solicitante_id = auth.uid()
                  or auth_rol() = 'acceso_total'
              )
        )
    );

drop policy if exists solicitudes_material_delete on solicitudes_material;
create policy solicitudes_material_delete on solicitudes_material for delete
    using (
        auth_rol() = 'acceso_total'
        or (solicitante_id = auth.uid() and estado = 'recibida')
    );

drop policy if exists ordenes_compra_select on ordenes_compra;
create policy ordenes_compra_select on ordenes_compra for select
    using (
        auth_rol() in (
            'compras', 'finanzas', 'operacion', 'proyectos', 'acceso_total'
        )
    );

drop policy if exists orden_compra_items_select on orden_compra_items;
create policy orden_compra_items_select on orden_compra_items for select
    using (
        auth_rol() in (
            'compras', 'finanzas', 'operacion', 'proyectos', 'acceso_total'
        )
    );

-- =====================================================================
-- Trigger de transiciones (reemplaza el de Fase 3)
-- Estados de app: recibida → en_proceso → finalizada | rechazada | cancelada
-- Legacy pendiente/en_cotizacion/aprobada se migraron arriba.
-- =====================================================================
create or replace function fn_solicitudes_material_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    rol rol_usuario := auth_rol();
    transicion_ok boolean := false;
begin
    if rol = 'acceso_total' then
        return NEW;
    end if;

    if NEW.obra_id is distinct from OLD.obra_id
       or NEW.solicitante_id is distinct from OLD.solicitante_id
       or NEW.creado_en is distinct from OLD.creado_en then
        raise exception 'No se pueden modificar obra, solicitante ni fecha de creación.';
    end if;

    if NEW.estado is not distinct from OLD.estado then
        return NEW;
    end if;

    if rol = 'personal' then
        if NEW.nota is distinct from OLD.nota then
            raise exception 'Solo se permite cancelar la solicitud.';
        end if;
        transicion_ok := (OLD.estado = 'recibida' and NEW.estado = 'cancelada');
    elsif rol = 'compras' then
        transicion_ok := (
            (OLD.estado = 'recibida' and NEW.estado in ('en_proceso', 'rechazada'))
            or (OLD.estado = 'en_proceso' and NEW.estado in ('finalizada', 'rechazada'))
            or (OLD.estado = 'pendiente' and NEW.estado in ('en_proceso', 'en_cotizacion', 'rechazada'))
            or (OLD.estado = 'en_cotizacion' and NEW.estado in ('aprobada', 'rechazada', 'finalizada', 'en_proceso'))
        );
    elsif rol = 'finanzas' then
        transicion_ok := (
            OLD.estado = 'en_proceso'
            and NEW.estado in ('finalizada', 'rechazada', 'cancelada')
        );
    end if;

    if not transicion_ok then
        raise exception 'Transición de estatus no permitida para tu rol.';
    end if;

    return NEW;
end;
$$;

-- =====================================================================
-- RPC: aprobar compras (Thalía) — reserva saldo
-- =====================================================================
create or replace function aprobar_solicitud_compras(p_solicitud_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_rol rol_usuario := auth_rol();
    v_uid uuid := auth.uid();
    v_sol solicitudes_material%rowtype;
    v_item record;
    v_monto_total numeric(14,2) := 0;
    v_disponible_mat numeric(12,2);
    v_disponible_mxn numeric(14,2);
begin
    if v_uid is null or v_rol is null then
        raise exception 'No autenticado.';
    end if;
    if v_rol not in ('compras', 'acceso_total') then
        raise exception 'Solo Compras puede aprobar requisiciones.';
    end if;

    select * into v_sol from solicitudes_material where id = p_solicitud_id for update;
    if not found then
        raise exception 'La requisición no existe.';
    end if;
    if v_sol.estado <> 'recibida' then
        raise exception 'Solo se pueden aprobar requisiciones en estatus recibida.';
    end if;

    for v_item in
        select * from solicitud_items where solicitud_id = p_solicitud_id
    loop
        if v_item.tipo_linea = 'material' then
            select cantidad_disponible into v_disponible_mat
            from v_saldo_material_obra
            where obra_id = v_sol.obra_id and material_id = v_item.material_id;

            if v_disponible_mat is null then
                raise exception 'El material no tiene presupuesto de cantidad en este proyecto.';
            end if;
            if v_disponible_mat < v_item.cantidad_solicitada then
                raise exception 'Saldo de cantidad insuficiente para un material de la requisición.';
            end if;

            insert into solicitud_reservas_cantidad (
                solicitud_id, obra_id, material_id, cantidad, estado
            ) values (
                p_solicitud_id, v_sol.obra_id, v_item.material_id,
                v_item.cantidad_solicitada, 'activa'
            );
        else
            v_monto_total := v_monto_total + coalesce(v_item.monto_mxn, 0);
        end if;
    end loop;

    if v_monto_total > 0 then
        select disponible_mxn into v_disponible_mxn
        from v_saldo_presupuesto_obra
        where obra_id = v_sol.obra_id;

        if coalesce(v_disponible_mxn, 0) < v_monto_total then
            raise exception 'Presupuesto monetario insuficiente para esta requisición.';
        end if;

        insert into obra_presupuesto_movimientos (
            obra_id, solicitud_id, tipo, monto_mxn, nota, creado_por
        ) values (
            v_sol.obra_id, p_solicitud_id, 'reserva', v_monto_total,
            'Reserva por aprobación de Compras', v_uid
        );
    end if;

    update solicitudes_material
    set estado = 'en_proceso'
    where id = p_solicitud_id;

    insert into notificaciones (rol_destino, titulo, mensaje, tipo, referencia_id)
    values (
        'finanzas',
        'Requisición lista para pago',
        'Compras aprobó una requisición. Pendiente de pago/aprobación de Finanzas.',
        'solicitud_en_proceso',
        p_solicitud_id
    );
end;
$$;

revoke all on function public.aprobar_solicitud_compras(uuid) from public;
revoke all on function public.aprobar_solicitud_compras(uuid) from anon;
grant execute on function public.aprobar_solicitud_compras(uuid) to authenticated;

-- =====================================================================
-- RPC: aprobar pago (Blanquita) — gasta reserva y emite OC
-- =====================================================================
create or replace function aprobar_pago_solicitud(p_solicitud_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_rol rol_usuario := auth_rol();
    v_uid uuid := auth.uid();
    v_sol solicitudes_material%rowtype;
    v_item record;
    v_monto_total numeric(14,2) := 0;
    v_orden_id uuid;
    v_folio text;
    v_total_oc numeric(14,2) := 0;
begin
    if v_uid is null or v_rol is null then
        raise exception 'No autenticado.';
    end if;
    if v_rol not in ('finanzas', 'acceso_total') then
        raise exception 'Solo Finanzas puede aprobar el pago.';
    end if;

    select * into v_sol from solicitudes_material where id = p_solicitud_id for update;
    if not found then
        raise exception 'La requisición no existe.';
    end if;
    if v_sol.estado <> 'en_proceso' then
        raise exception 'Solo se pueden pagar requisiciones en proceso.';
    end if;

    for v_item in
        select * from solicitud_items where solicitud_id = p_solicitud_id
    loop
        if v_item.tipo_linea = 'material' then
            v_total_oc := v_total_oc + coalesce(v_item.monto_mxn, 0);
        else
            v_monto_total := v_monto_total + coalesce(v_item.monto_mxn, 0);
            v_total_oc := v_total_oc + coalesce(v_item.monto_mxn, 0);
        end if;
    end loop;

    -- Liberar reserva monetaria y registrar gasto
    if v_monto_total > 0 then
        insert into obra_presupuesto_movimientos (
            obra_id, solicitud_id, tipo, monto_mxn, nota, creado_por
        ) values (
            v_sol.obra_id, p_solicitud_id, 'liberacion', v_monto_total,
            'Libera reserva al pagar', v_uid
        );
        insert into obra_presupuesto_movimientos (
            obra_id, solicitud_id, tipo, monto_mxn, nota, creado_por
        ) values (
            v_sol.obra_id, p_solicitud_id, 'gasto', v_monto_total,
            'Gasto al pagar requisición', v_uid
        );
    end if;

    update solicitud_reservas_cantidad
    set estado = 'aplicada'
    where solicitud_id = p_solicitud_id and estado = 'activa';

    v_folio := next_folio_orden_compra();
    insert into ordenes_compra (
        folio, cotizacion_id, proveedor_id, obra_id, solicitud_id,
        estado, total, moneda, creado_por
    ) values (
        v_folio, null, null, v_sol.obra_id, p_solicitud_id,
        'emitida', v_total_oc, 'MXN', v_uid
    )
    returning id into v_orden_id;

    for v_item in
        select * from solicitud_items where solicitud_id = p_solicitud_id
    loop
        if v_item.tipo_linea = 'material' then
            insert into orden_compra_items (
                orden_id, material_id, cantidad, precio_unitario, subtotal,
                descripcion, tipo_linea
            ) values (
                v_orden_id,
                v_item.material_id,
                v_item.cantidad_solicitada,
                case
                    when coalesce(v_item.monto_mxn, 0) > 0
                         and v_item.cantidad_solicitada > 0
                    then round(v_item.monto_mxn / v_item.cantidad_solicitada, 2)
                    else 0
                end,
                coalesce(v_item.monto_mxn, 0),
                null,
                'material'
            );
        else
            insert into orden_compra_items (
                orden_id, material_id, cantidad, precio_unitario, subtotal,
                descripcion, tipo_linea
            ) values (
                v_orden_id,
                null,
                1,
                v_item.monto_mxn,
                v_item.monto_mxn,
                v_item.descripcion,
                v_item.tipo_linea
            );
        end if;
    end loop;

    update solicitudes_material
    set estado = 'finalizada'
    where id = p_solicitud_id;

    insert into notificaciones (usuario_id, titulo, mensaje, tipo, referencia_id)
    values (
        v_sol.solicitante_id,
        'Requisición pagada',
        'Finanzas aprobó el pago. Orden ' || v_folio || '.',
        'solicitud_finalizada',
        p_solicitud_id
    );

    return v_orden_id;
end;
$$;

revoke all on function public.aprobar_pago_solicitud(uuid) from public;
revoke all on function public.aprobar_pago_solicitud(uuid) from anon;
grant execute on function public.aprobar_pago_solicitud(uuid) to authenticated;

-- =====================================================================
-- RPC: rechazar (compras o finanzas según estado)
-- =====================================================================
create or replace function rechazar_solicitud(p_solicitud_id uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_rol rol_usuario := auth_rol();
    v_uid uuid := auth.uid();
    v_sol solicitudes_material%rowtype;
    v_monto numeric(14,2);
begin
    if v_uid is null or v_rol is null then
        raise exception 'No autenticado.';
    end if;

    select * into v_sol from solicitudes_material where id = p_solicitud_id for update;
    if not found then
        raise exception 'La requisición no existe.';
    end if;

    if v_sol.estado = 'recibida' and v_rol in ('compras', 'acceso_total') then
        null;
    elsif v_sol.estado = 'en_proceso' and v_rol in ('finanzas', 'compras', 'acceso_total') then
        -- Liberar reservas
        update solicitud_reservas_cantidad
        set estado = 'liberada'
        where solicitud_id = p_solicitud_id and estado = 'activa';

        select coalesce(sum(monto_mxn), 0) into v_monto
        from obra_presupuesto_movimientos
        where solicitud_id = p_solicitud_id and tipo = 'reserva';

        v_monto := v_monto - coalesce((
            select sum(monto_mxn)
            from obra_presupuesto_movimientos
            where solicitud_id = p_solicitud_id and tipo = 'liberacion'
        ), 0);

        if v_monto > 0 then
            insert into obra_presupuesto_movimientos (
                obra_id, solicitud_id, tipo, monto_mxn, nota, creado_por
            ) values (
                v_sol.obra_id, p_solicitud_id, 'liberacion', v_monto,
                coalesce(p_motivo, 'Rechazo — libera reserva'), v_uid
            );
        end if;
    else
        raise exception 'No puedes rechazar esta requisición en su estatus actual.';
    end if;

    update solicitudes_material
    set estado = 'rechazada',
        nota = case
            when p_motivo is null or length(trim(p_motivo)) = 0 then nota
            when nota is null then 'Rechazo: ' || trim(p_motivo)
            else nota || E'\nRechazo: ' || trim(p_motivo)
        end
    where id = p_solicitud_id;

    insert into notificaciones (usuario_id, titulo, mensaje, tipo, referencia_id)
    values (
        v_sol.solicitante_id,
        'Requisición rechazada',
        coalesce(p_motivo, 'Tu requisición fue rechazada.'),
        'solicitud_rechazada',
        p_solicitud_id
    );
end;
$$;

revoke all on function public.rechazar_solicitud(uuid, text) from public;
revoke all on function public.rechazar_solicitud(uuid, text) from anon;
grant execute on function public.rechazar_solicitud(uuid, text) to authenticated;

-- Cancelación vía RPC para liberar si hubiera reservas (personal solo recibida)
create or replace function cancelar_solicitud(p_solicitud_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_rol rol_usuario := auth_rol();
    v_uid uuid := auth.uid();
    v_sol solicitudes_material%rowtype;
begin
    if v_uid is null or v_rol is null then
        raise exception 'No autenticado.';
    end if;

    select * into v_sol from solicitudes_material where id = p_solicitud_id for update;
    if not found then
        raise exception 'La requisición no existe.';
    end if;

    if v_rol = 'acceso_total' then
        null;
    elsif v_rol = 'personal' and v_sol.solicitante_id = v_uid and v_sol.estado = 'recibida' then
        null;
    else
        raise exception 'No puedes cancelar esta requisición.';
    end if;

    if v_sol.estado not in ('recibida', 'en_proceso') then
        raise exception 'Esta requisición ya no se puede cancelar.';
    end if;

    if v_sol.estado = 'en_proceso' then
        perform rechazar_solicitud(p_solicitud_id, 'Cancelada');
        update solicitudes_material
        set estado = 'cancelada', cancelado_en = now()
        where id = p_solicitud_id;
        return;
    end if;

    update solicitudes_material
    set estado = 'cancelada', cancelado_en = now()
    where id = p_solicitud_id;
end;
$$;

-- Ampliar policy UPDATE para el nuevo flujo (recibida / en_proceso / finanzas)
drop policy if exists solicitudes_material_update on solicitudes_material;

create policy solicitudes_material_update on solicitudes_material for update
    using (
        auth_rol() = 'acceso_total'
        or (solicitante_id = auth.uid() and estado = 'recibida')
        or (auth_rol() = 'compras' and estado in ('recibida', 'en_proceso'))
        or (auth_rol() = 'finanzas' and estado = 'en_proceso')
    )
    with check (
        auth_rol() = 'acceso_total'
        or (solicitante_id = auth.uid() and estado in ('recibida', 'cancelada'))
        or (auth_rol() = 'compras' and estado in ('recibida', 'en_proceso', 'rechazada', 'finalizada'))
        or (auth_rol() = 'finanzas' and estado in ('en_proceso', 'finalizada', 'rechazada', 'cancelada'))
    );

-- Insert OC también desde finanzas (vía app si hiciera falta; RPC ya es definer)
drop policy if exists ordenes_compra_insert on ordenes_compra;
create policy ordenes_compra_insert on ordenes_compra for insert
    with check (
        creado_por = auth.uid()
        and auth_rol() in ('compras', 'finanzas', 'acceso_total')
    );

drop policy if exists orden_compra_items_insert on orden_compra_items;
create policy orden_compra_items_insert on orden_compra_items for insert
    with check (
        exists (
            select 1 from ordenes_compra oc
            where oc.id = orden_compra_items.orden_id
              and auth_rol() in ('compras', 'finanzas', 'acceso_total')
        )
    );

revoke all on function public.cancelar_solicitud(uuid) from public;
revoke all on function public.cancelar_solicitud(uuid) from anon;
grant execute on function public.cancelar_solicitud(uuid) to authenticated;
