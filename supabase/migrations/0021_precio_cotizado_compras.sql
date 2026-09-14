-- =====================================================================
-- MIGRACIÓN 0021 — Precio cotizado en aprobación de Compras
-- 1. aprobar_solicitud_compras acepta precios unitarios (jsonb) y los
--    persiste en solicitud_items.monto_mxn antes de reservar.
-- 2. Exige monto > 0 en líneas material.
-- 3. Reserva dinero por TODAS las líneas con monto (material + otras),
--    agrupado por obra (multi-obra).
-- 4. aprobar_pago_solicitud libera/gasta la reserva pendiente completa
--    (no solo líneas no-material), para cuadrar con (3).
--
-- NO APLICAR sin revisión de Emilio. Escribe el agente; aplica el humano.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- aprobar_solicitud_compras(uuid, jsonb)
-- p_precios: [{"item_id":"<uuid>","precio_unitario":123.45}, ...]
-- ---------------------------------------------------------------------
drop function if exists public.aprobar_solicitud_compras(uuid);
drop function if exists public.aprobar_solicitud_compras(uuid, jsonb);

create or replace function public.aprobar_solicitud_compras(
    p_solicitud_id uuid,
    p_precios jsonb default '[]'::jsonb
)
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
    v_precio numeric(14,2);
    v_monto numeric(14,2);
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

    -- Aplicar precios cotizados (unitario → monto_mxn = unitario × cantidad)
    if p_precios is not null and jsonb_typeof(p_precios) = 'array' then
        for v_item in
            select *
            from jsonb_to_recordset(p_precios) as x(item_id uuid, precio_unitario numeric)
        loop
            if v_item.item_id is null then
                continue;
            end if;
            v_precio := round(coalesce(v_item.precio_unitario, 0), 2);
            if v_precio < 0 then
                raise exception 'El precio cotizado no puede ser negativo.';
            end if;

            update solicitud_items si
            set monto_mxn = case
                when si.tipo_linea = 'material'
                     and coalesce(si.cantidad_solicitada, 0) > 0
                then round(v_precio * si.cantidad_solicitada, 2)
                else v_precio
            end
            where si.id = v_item.item_id
              and si.solicitud_id = p_solicitud_id;

            if not found then
                raise exception 'Uno de los precios no corresponde a esta requisición.';
            end if;
        end loop;
    end if;

    -- Validar y reservar cantidad (materiales)
    for v_item in
        select *, coalesce(obra_id, v_sol.obra_id) as obra_efectiva
        from solicitud_items
        where solicitud_id = p_solicitud_id and tipo_linea = 'material'
    loop
        if coalesce(v_item.monto_mxn, 0) <= 0 then
            raise exception 'Falta el precio cotizado en uno o más materiales.';
        end if;

        select cantidad_disponible into v_disponible_mat
        from v_saldo_material_obra
        where obra_id = v_item.obra_efectiva and material_id = v_item.material_id;

        if v_disponible_mat is null then
            raise exception 'El material no tiene presupuesto de cantidad en el proyecto de uno de los materiales.';
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

    -- Reservar dinero por obra (todas las líneas con monto)
    for v_grupo in
        select
            coalesce(obra_id, v_sol.obra_id) as obra_efectiva,
            coalesce(sum(monto_mxn), 0) as monto_total
        from solicitud_items
        where solicitud_id = p_solicitud_id
        group by coalesce(obra_id, v_sol.obra_id)
    loop
        v_monto := v_grupo.monto_total;
        if v_monto <= 0 then
            continue;
        end if;

        select disponible_mxn into v_disponible_mxn
        from v_saldo_presupuesto_obra
        where obra_id = v_grupo.obra_efectiva;

        if coalesce(v_disponible_mxn, 0) < v_monto then
            raise exception 'Presupuesto monetario insuficiente para esta requisición.';
        end if;

        insert into obra_presupuesto_movimientos (
            obra_id, solicitud_id, tipo, monto_mxn, nota, creado_por
        ) values (
            v_grupo.obra_efectiva, p_solicitud_id, 'reserva', v_monto,
            'Reserva por aprobación de Compras (materiales + partidas)', v_uid
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

revoke all on function public.aprobar_solicitud_compras(uuid, jsonb) from public;
revoke all on function public.aprobar_solicitud_compras(uuid, jsonb) from anon;
grant execute on function public.aprobar_solicitud_compras(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- aprobar_pago_solicitud: liberar/gastar reserva pendiente completa
-- ---------------------------------------------------------------------
create or replace function public.aprobar_pago_solicitud(p_solicitud_id uuid)
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
    v_reserva record;
    v_orden_id uuid;
    v_folio text;
    v_ordenes uuid[] := '{}';
    v_pendiente numeric(14,2);
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

    -- Liberar + gastar la reserva pendiente por obra (incluye materiales)
    for v_reserva in
        select
            obra_id,
            coalesce(sum(monto_mxn) filter (where tipo = 'reserva'), 0)
                - coalesce(sum(monto_mxn) filter (where tipo = 'liberacion'), 0) as monto_pendiente
        from obra_presupuesto_movimientos
        where solicitud_id = p_solicitud_id
        group by obra_id
    loop
        v_pendiente := v_reserva.monto_pendiente;
        if v_pendiente > 0 then
            insert into obra_presupuesto_movimientos (
                obra_id, solicitud_id, tipo, monto_mxn, nota, creado_por
            ) values (
                v_reserva.obra_id, p_solicitud_id, 'liberacion', v_pendiente,
                'Libera reserva al pagar', v_uid
            );
            insert into obra_presupuesto_movimientos (
                obra_id, solicitud_id, tipo, monto_mxn, nota, creado_por
            ) values (
                v_reserva.obra_id, p_solicitud_id, 'gasto', v_pendiente,
                'Gasto al pagar requisición', v_uid
            );
        end if;
    end loop;

    for v_grupo in
        select
            coalesce(obra_id, v_sol.obra_id) as obra_efectiva,
            coalesce(sum(monto_mxn), 0) as monto_total
        from solicitud_items
        where solicitud_id = p_solicitud_id
        group by coalesce(obra_id, v_sol.obra_id)
    loop
        v_folio := next_folio_orden_compra();
        insert into ordenes_compra (
            folio, cotizacion_id, proveedor_id, obra_id, solicitud_id,
            estado, total, moneda, creado_por
        ) values (
            v_folio, null, null, v_grupo.obra_efectiva, p_solicitud_id,
            'emitida', v_grupo.monto_total, 'MXN', v_uid
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

commit;
