-- =====================================================================
-- MIGRACIÓN 0008 — Requisición multi-obra (Fase 5)
-- Permite que una requisición tenga renglones de distintas obras.
-- La cabecera (solicitudes_material.obra_id) sigue siendo obligatoria y
-- guarda la obra del primer renglón capturado, solo como referencia para
-- vistas que hoy asumen "una obra por requisición" (lista, notificaciones).
-- La obra real de cada renglón vive en solicitud_items.obra_id; cuando es
-- null, hereda la de la cabecera (comportamiento actual de Personal, sin
-- cambios).
-- =====================================================================

alter table solicitud_items
    add column if not exists obra_id uuid references obras(id);

create index if not exists idx_solicitud_items_obra on solicitud_items(obra_id);

-- Antes: unique (solicitud_id, material_id) — impedía repetir un material
-- en la misma requisición sin importar la obra. Ahora debe permitir el
-- mismo material en obras distintas, pero seguir bloqueando repetirlo en
-- la misma obra. coalesce(...) hace que los renglones con obra_id null
-- (flujo normal de Personal, todos heredan la obra de la cabecera) sigan
-- colisionando entre sí exactamente igual que hoy.
drop index if exists solicitud_items_solicitud_material_uidx;

create unique index solicitud_items_solicitud_material_obra_uidx
    on solicitud_items (
        solicitud_id,
        material_id,
        coalesce(obra_id, '00000000-0000-0000-0000-000000000000'::uuid)
    )
    where material_id is not null;

-- Antes: unique (solicitud_id, material_id) en las reservas — con
-- multi-obra puede haber 2 reservas del mismo material en la misma
-- solicitud (una por obra). Aquí obra_id siempre es no-nulo (se resuelve
-- antes de insertar en las RPCs de abajo), así que no hace falta coalesce.
alter table solicitud_reservas_cantidad
    drop constraint if exists solicitud_reservas_cantidad_solicitud_id_material_id_key;

alter table solicitud_reservas_cantidad
    add constraint solicitud_reservas_cantidad_solicitud_material_obra_key
    unique (solicitud_id, material_id, obra_id);

-- Compras (Talía) ahora puede levantar requisiciones (multi-obra o no).
drop policy if exists solicitudes_material_insert on solicitudes_material;

create policy solicitudes_material_insert on solicitudes_material for insert
    with check (
        solicitante_id = auth.uid()
        and auth_rol() in ('personal', 'compras', 'acceso_total')
    );

-- =====================================================================
-- RPC: aprobar compras (Thalía) — reserva saldo, agrupado por obra
-- resuelta de cada renglón (coalesce(item.obra_id, cabecera.obra_id)).
-- Todo-o-nada: si cualquier obra involucrada no tiene saldo, la función
-- completa lanza excepción y no reserva nada (atomicidad de transacción).
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
    v_grupo record;
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
        select *, coalesce(obra_id, v_sol.obra_id) as obra_efectiva
        from solicitud_items
        where solicitud_id = p_solicitud_id and tipo_linea = 'material'
    loop
        select cantidad_disponible into v_disponible_mat
        from v_saldo_material_obra
        where obra_id = v_item.obra_efectiva and material_id = v_item.material_id;

        if v_disponible_mat is null then
            raise exception 'El material no tiene presupuesto de cantidad en el proyecto de uno de los renglones.';
        end if;
        if v_disponible_mat < v_item.cantidad_solicitada then
            raise exception 'Saldo de cantidad insuficiente para un material de la requisición.';
        end if;

        insert into solicitud_reservas_cantidad (
            solicitud_id, obra_id, material_id, cantidad, estado
        ) values (
            p_solicitud_id, v_item.obra_efectiva, v_item.material_id,
            v_item.cantidad_solicitada, 'activa'
        );
    end loop;

    for v_grupo in
        select
            coalesce(obra_id, v_sol.obra_id) as obra_efectiva,
            sum(monto_mxn) as monto_total
        from solicitud_items
        where solicitud_id = p_solicitud_id and tipo_linea <> 'material'
        group by coalesce(obra_id, v_sol.obra_id)
    loop
        select disponible_mxn into v_disponible_mxn
        from v_saldo_presupuesto_obra
        where obra_id = v_grupo.obra_efectiva;

        if coalesce(v_disponible_mxn, 0) < v_grupo.monto_total then
            raise exception 'Presupuesto monetario insuficiente para esta requisición.';
        end if;

        insert into obra_presupuesto_movimientos (
            obra_id, solicitud_id, tipo, monto_mxn, nota, creado_por
        ) values (
            v_grupo.obra_efectiva, p_solicitud_id, 'reserva', v_grupo.monto_total,
            'Reserva por aprobación de Compras', v_uid
        );
    end loop;

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
-- RPC: aprobar pago (Blanquita) — emite UNA orden de compra POR CADA
-- obra distinta involucrada. Cambia el tipo de retorno de uuid a uuid[]
-- (por eso el drop function antes del create or replace).
-- =====================================================================
drop function if exists aprobar_pago_solicitud(uuid);

create or replace function aprobar_pago_solicitud(p_solicitud_id uuid)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
    v_rol rol_usuario := auth_rol();
    v_uid uuid := auth.uid();
    v_sol solicitudes_material%rowtype;
    v_item record;
    v_grupo record;
    v_orden_id uuid;
    v_folio text;
    v_ordenes uuid[] := '{}';
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

    for v_grupo in
        select
            coalesce(obra_id, v_sol.obra_id) as obra_efectiva,
            sum(monto_mxn) filter (where tipo_linea <> 'material') as monto_no_material,
            sum(monto_mxn) as monto_total
        from solicitud_items
        where solicitud_id = p_solicitud_id
        group by coalesce(obra_id, v_sol.obra_id)
    loop
        if coalesce(v_grupo.monto_no_material, 0) > 0 then
            insert into obra_presupuesto_movimientos (
                obra_id, solicitud_id, tipo, monto_mxn, nota, creado_por
            ) values (
                v_grupo.obra_efectiva, p_solicitud_id, 'liberacion', v_grupo.monto_no_material,
                'Libera reserva al pagar', v_uid
            );
            insert into obra_presupuesto_movimientos (
                obra_id, solicitud_id, tipo, monto_mxn, nota, creado_por
            ) values (
                v_grupo.obra_efectiva, p_solicitud_id, 'gasto', v_grupo.monto_no_material,
                'Gasto al pagar requisición', v_uid
            );
        end if;

        v_folio := next_folio_orden_compra();
        insert into ordenes_compra (
            folio, cotizacion_id, proveedor_id, obra_id, solicitud_id,
            estado, total, moneda, creado_por
        ) values (
            v_folio, null, null, v_grupo.obra_efectiva, p_solicitud_id,
            'emitida', coalesce(v_grupo.monto_total, 0), 'MXN', v_uid
        )
        returning id into v_orden_id;

        v_ordenes := array_append(v_ordenes, v_orden_id);

        for v_item in
            select *, coalesce(obra_id, v_sol.obra_id) as obra_efectiva
            from solicitud_items
            where solicitud_id = p_solicitud_id
              and coalesce(obra_id, v_sol.obra_id) = v_grupo.obra_efectiva
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
    end loop;

    update solicitud_reservas_cantidad
    set estado = 'aplicada'
    where solicitud_id = p_solicitud_id and estado = 'activa';

    update solicitudes_material
    set estado = 'finalizada'
    where id = p_solicitud_id;

    insert into notificaciones (usuario_id, titulo, mensaje, tipo, referencia_id)
    values (
        v_sol.solicitante_id,
        'Requisición pagada',
        case
            when array_length(v_ordenes, 1) > 1
            then 'Finanzas aprobó el pago. Se generaron ' || array_length(v_ordenes, 1) || ' órdenes de compra.'
            else 'Finanzas aprobó el pago. Orden ' || v_folio || '.'
        end,
        'solicitud_finalizada',
        p_solicitud_id
    );

    return v_ordenes;
end;
$$;

revoke all on function public.aprobar_pago_solicitud(uuid) from public;
revoke all on function public.aprobar_pago_solicitud(uuid) from anon;
grant execute on function public.aprobar_pago_solicitud(uuid) to authenticated;

-- =====================================================================
-- RPC: rechazar — corrección de bug real, no solo adaptación. Antes
-- liberaba el dinero como UN monto acreditado a la obra de la cabecera;
-- con multi-obra eso acreditaría mal el dinero de una obra a otra. Ahora
-- libera el monto pendiente de CADA obra a su propio obra_id.
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
    v_grupo record;
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
        update solicitud_reservas_cantidad
        set estado = 'liberada'
        where solicitud_id = p_solicitud_id and estado = 'activa';

        for v_grupo in
            select
                obra_id,
                coalesce(sum(monto_mxn) filter (where tipo = 'reserva'), 0)
                    - coalesce(sum(monto_mxn) filter (where tipo = 'liberacion'), 0) as monto_pendiente
            from obra_presupuesto_movimientos
            where solicitud_id = p_solicitud_id
            group by obra_id
        loop
            if v_grupo.monto_pendiente > 0 then
                insert into obra_presupuesto_movimientos (
                    obra_id, solicitud_id, tipo, monto_mxn, nota, creado_por
                ) values (
                    v_grupo.obra_id, p_solicitud_id, 'liberacion', v_grupo.monto_pendiente,
                    coalesce(p_motivo, 'Rechazo — libera reserva'), v_uid
                );
            end if;
        end loop;
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
