-- MIGRACIÓN 0027 — Corrección de saldo en aprobación de Compras, Proveedores por partida y Edición de partidas
-- 1. Agrega proveedor_id a solicitud_items para asignar proveedor por material en Compras
-- 2. Corrige el falso error "Saldo de cantidad insuficiente": evita el doble descuento de la requisición actual
-- 3. Mensajes de error específicos con detalle de partida, material y saldos
-- 4. Soporta edición de cantidades y asignación de proveedores al cotizar/aprobar
-- 5. Función para eliminar partidas a discreción en estado recibida

-- 1. Columna proveedor_id en solicitud_items
alter table public.solicitud_items
    add column if not exists proveedor_id uuid references public.proveedores(id);

create index if not exists idx_solicitud_items_proveedor on public.solicitud_items(proveedor_id);

-- 2. Eliminar partida individual antes de aprobar (solo Compras o Acceso Total en recibida)
create or replace function public.eliminar_item_solicitud(
    p_solicitud_id uuid,
    p_item_id uuid
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
    v_total_items int;
begin
    if v_uid is null or v_rol is null then
        raise exception 'No autenticado.';
    end if;
    if v_rol not in ('compras', 'acceso_total') then
        raise exception 'Solo Compras o Acceso Total pueden modificar renglones de la requisición.';
    end if;

    select * into v_sol from solicitudes_material where id = p_solicitud_id for update;
    if not found then
        raise exception 'La requisición no existe.';
    end if;
    if v_sol.estado <> 'recibida' then
        raise exception 'Solo se pueden modificar renglones en requisiciones con estatus recibida.';
    end if;

    select count(*) into v_total_items
    from solicitud_items
    where solicitud_id = p_solicitud_id;

    if v_total_items <= 1 then
        raise exception 'La requisición debe conservar al menos una partida. Si deseas anularla completa, utiliza la opción Rechazar o Cancelar.';
    end if;

    delete from solicitud_items
    where id = p_item_id and solicitud_id = p_solicitud_id;

    if not found then
        raise exception 'La partida que intentas eliminar no existe en esta requisición.';
    end if;
end;
$$;

-- 3. Función aprobar_solicitud_compras corregida y enriquecida
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
    v_solicitado_en_esta_solicitud numeric(12,2);
    v_disponible_real numeric(12,2);
    v_disponible_mxn numeric(14,2);
    v_precio numeric(14,2);
    v_monto numeric(14,2);
    v_mat_nombre text;
    v_mat_variante text;
    v_mat_unidad text;
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

    -- Aplicar precios cotizados, cantidades ajustadas y proveedores asignados
    if p_precios is not null and jsonb_typeof(p_precios) = 'array' then
        for v_item in
            select *
            from jsonb_to_recordset(p_precios) as x(
                item_id uuid,
                precio_unitario numeric,
                cantidad_solicitada numeric,
                proveedor_id uuid
            )
        loop
            if v_item.item_id is null then
                continue;
            end if;
            v_precio := round(coalesce(v_item.precio_unitario, 0), 2);
            if v_precio < 0 then
                raise exception 'El precio cotizado no puede ser negativo.';
            end if;

            if v_item.cantidad_solicitada is not null and v_item.cantidad_solicitada <= 0 then
                raise exception 'La cantidad de cada partida debe ser mayor a cero.';
            end if;

            update solicitud_items si
            set
                cantidad_solicitada = coalesce(v_item.cantidad_solicitada, si.cantidad_solicitada),
                monto_mxn = case
                    when si.tipo_linea = 'material'
                    then round(v_precio * coalesce(v_item.cantidad_solicitada, si.cantidad_solicitada, 0), 2)
                    else v_precio
                end,
                proveedor_id = coalesce(v_item.proveedor_id, si.proveedor_id)
            where si.id = v_item.item_id
              and si.solicitud_id = p_solicitud_id;

            if not found then
                raise exception 'Uno de los renglones no corresponde a esta requisición.';
            end if;
        end loop;
    end if;

    -- Validar y reservar cantidad (materiales)
    -- NOTA CRÍTICA: v_saldo_material_obra ya descuenta las solicitudes_pendientes en estado 'recibida'.
    -- Para evitar el DOBLE DESCUENTO de la propia requisición que se está aprobando, sumamos de vuelta
    -- la cantidad solicitada original de esta solicitud antes de comparar contra lo requerido.
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
            select cm.nombre_base, cm.variante into v_mat_nombre, v_mat_variante
            from catalogo_materiales cm where cm.id = v_item.material_id;

            raise exception 'El material "%" no tiene presupuesto asignado en el proyecto.',
                coalesce(v_mat_nombre || coalesce(' · ' || v_mat_variante, ''), 'Material');
        end if;

        -- Sumar la cantidad de esta solicitud que ya estaba descontada provisionalmente en v_saldo_material_obra
        select coalesce(sum(si.cantidad_solicitada), 0) into v_solicitado_en_esta_solicitud
        from solicitud_items si
        where si.solicitud_id = p_solicitud_id
          and si.material_id = v_item.material_id
          and coalesce(si.obra_id, v_sol.obra_id) = v_item.obra_efectiva;

        v_disponible_real := coalesce(v_disponible_mat, 0) + v_solicitado_en_esta_solicitud;

        if v_disponible_real < v_item.cantidad_solicitada then
            select cm.nombre_base, cm.variante, cm.unidad_medida
            into v_mat_nombre, v_mat_variante, v_mat_unidad
            from catalogo_materiales cm
            where cm.id = v_item.material_id;

            raise exception 'Saldo insuficiente en partida "%": solicitas % %, pero solo hay % % disponible en el proyecto.',
                coalesce(v_mat_nombre || coalesce(' · ' || v_mat_variante, ''), 'Material'),
                v_item.cantidad_solicitada,
                coalesce(v_mat_unidad, 'pza'),
                greatest(0, v_disponible_real),
                coalesce(v_mat_unidad, 'pza');
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
            raise exception 'Presupuesto monetario insuficiente en el proyecto: la cotización total ($%) supera el disponible presupuestal ($%).',
                to_char(v_monto, 'FM999,999,999.00'),
                to_char(coalesce(v_disponible_mxn, 0), 'FM999,999,999.00');
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
        'Compras aprobó una requisición con precios y proveedores. Pendiente de aprobación de Finanzas.',
        'solicitud_en_proceso',
        p_solicitud_id
    );
end;
$$;

-- 4. Finanzas: Generar órdenes de compra agrupadas por obra y proveedor
create or replace function public.aprobar_pago_solicitud(
    p_solicitud_id uuid
)
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

    -- Agrupar OC por obra_efectiva y proveedor_id (cada proveedor recibe su propia orden de compra)
    for v_grupo in
        select
            coalesce(obra_id, v_sol.obra_id) as obra_efectiva,
            proveedor_id,
            coalesce(sum(monto_mxn), 0) as monto_total
        from solicitud_items
        where solicitud_id = p_solicitud_id
        group by coalesce(obra_id, v_sol.obra_id), proveedor_id
    loop
        v_folio := next_folio_orden_compra();
        insert into ordenes_compra (
            folio, cotizacion_id, proveedor_id, obra_id, solicitud_id,
            estado, total, moneda, creado_por
        ) values (
            v_folio, null, v_grupo.proveedor_id, v_grupo.obra_efectiva, p_solicitud_id,
            'emitida', v_grupo.monto_total, 'MXN', v_uid
        )
        returning id into v_orden_id;

        v_ordenes := array_append(v_ordenes, v_orden_id);

        for v_item in
            select *, coalesce(obra_id, v_sol.obra_id) as obra_efectiva
            from solicitud_items
            where solicitud_id = p_solicitud_id
              and coalesce(obra_id, v_sol.obra_id) = v_grupo.obra_efectiva
              and (proveedor_id is not distinct from v_grupo.proveedor_id)
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
                    coalesce(v_item.monto_mxn, 0),
                    coalesce(v_item.monto_mxn, 0),
                    v_item.descripcion,
                    v_item.tipo_linea
                );
            end if;
        end loop;
    end loop;

    -- Aplicar reservas de cantidad
    update solicitud_reservas_cantidad
    set estado = 'aplicada'
    where solicitud_id = p_solicitud_id;

    update solicitudes_material
    set estado = 'finalizada'
    where id = p_solicitud_id;

    insert into notificaciones (rol_destino, titulo, mensaje, tipo, referencia_id)
    values (
        'compras',
        'Pago aprobado y OC generada',
        'Finanzas aprobó el pago de la requisición. Se generaron las órdenes de compra.',
        'solicitud_finalizada',
        p_solicitud_id
    );

    return v_ordenes;
end;
$$;
