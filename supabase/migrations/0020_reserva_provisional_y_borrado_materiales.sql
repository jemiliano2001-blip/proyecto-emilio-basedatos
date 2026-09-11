-- =====================================================================
-- MIGRACIÓN 0020 — Reserva provisional de saldo en solicitudes y borrado de materiales
-- 1. Agrega política de eliminación (DELETE) para obra_material_contratado.
-- 2. Actualiza la vista v_saldo_material_obra para deducir provisionalmente
--    las cantidades de solicitudes recibidas/pendientes de aprobación,
--    impidiendo sobrepedidos concurrentes sobre el mismo saldo de obra.
-- =====================================================================

begin;

-- 1. POLÍTICA DE ELIMINACIÓN PARA TOPES / MATERIALES EN OBRA
drop policy if exists tope_delete on public.obra_material_contratado;
create policy tope_delete on public.obra_material_contratado for delete
    using (auth_rol() in ('operacion', 'proyectos', 'acceso_total'));

-- 2. VISTA v_saldo_material_obra CON RESERVA PROVISIONAL
drop view if exists public.v_saldo_material_obra cascade;
create view public.v_saldo_material_obra
with (security_invoker = true)
as
with
obras_materiales as (
    select
        obra_material_contratado.obra_id,
        obra_material_contratado.material_id,
        obra_material_contratado.cantidad_contratada
    from public.obra_material_contratado
    union
    select
        t.obra_destino_id as obra_id,
        ti.material_id,
        0::numeric as cantidad_contratada
    from public.traspasos_obra t
    join public.traspaso_items ti on ti.traspaso_id = t.id
    where t.estado = 'completado'
),
compras as (
    select
        oc.obra_id,
        oci.material_id,
        coalesce(sum(oci.cantidad), 0)::numeric(12,2) as total_comprado
    from public.orden_compra_items oci
    join public.ordenes_compra oc on oc.id = oci.orden_id
    where oc.estado in ('emitida', 'parcialmente_recibida', 'recibida')
    group by oc.obra_id, oci.material_id
),
en_proceso as (
    select
        r.obra_id,
        r.material_id,
        coalesce(sum(r.cantidad), 0)::numeric(12,2) as total_reservado_activo
    from public.solicitud_reservas_cantidad r
    where r.estado = 'activa'
    group by r.obra_id, r.material_id
),
solicitudes_pendientes as (
    select
        coalesce(si.obra_id, sm.obra_id) as obra_id,
        si.material_id,
        coalesce(sum(si.cantidad_solicitada), 0)::numeric(12,2) as total_solicitado_pendiente
    from public.solicitud_items si
    join public.solicitudes_material sm on sm.id = si.solicitud_id
    where sm.estado in ('recibida', 'pendiente')
    group by coalesce(si.obra_id, sm.obra_id), si.material_id
)
select
    om.obra_id,
    om.material_id,
    cm.nombre_base,
    cm.variante,
    cm.unidad_medida,

    -- 1. Asignado (contratado)
    coalesce(sum(om.cantidad_contratada), 0::numeric)::numeric(12,2) as cantidad_asignada,

    -- Traspasos
    coalesce((
        select sum(ti.cantidad)
        from public.traspasos_obra t
        join public.traspaso_items ti on ti.traspaso_id = t.id
        where t.obra_destino_id = om.obra_id
          and ti.material_id = om.material_id
          and t.estado = 'completado'
    ), 0::numeric)::numeric(12,2) as traspasos_entrada,

    coalesce((
        select sum(ti.cantidad)
        from public.traspasos_obra t
        join public.traspaso_items ti on ti.traspaso_id = t.id
        where t.obra_origen_id = om.obra_id
          and ti.material_id = om.material_id
          and t.estado in ('en_transito', 'completado')
    ), 0::numeric)::numeric(12,2) as traspasos_salida,

    -- 2. En proceso de compra (reservas activas + solicitudes pendientes recibidas)
    (
        greatest(0, coalesce(ep.total_reservado_activo, 0) - coalesce(c.total_comprado, 0))
        + coalesce(sp.total_solicitado_pendiente, 0)
    )::numeric(12,2) as cantidad_en_proceso,

    -- 3. Comprado
    coalesce(c.total_comprado, 0)::numeric(12,2) as cantidad_comprada,

    -- 4. Entregado en obra (aplicado físicamente)
    coalesce((
        select sum(r.cantidad)
        from public.solicitud_reservas_cantidad r
        where r.obra_id = om.obra_id
          and r.material_id = om.material_id
          and r.estado = 'aplicada'
    ), 0::numeric)::numeric(12,2) as cantidad_entregada,

    -- 5. Disponible = Asignado + Entradas - Salidas - (En proceso + Comprado)
    (
        coalesce(sum(om.cantidad_contratada), 0::numeric)
        + coalesce((
            select sum(ti.cantidad)
            from public.traspasos_obra t
            join public.traspaso_items ti on ti.traspaso_id = t.id
            where t.obra_destino_id = om.obra_id
              and ti.material_id = om.material_id
              and t.estado = 'completado'
        ), 0::numeric)
        - coalesce((
            select sum(ti.cantidad)
            from public.traspasos_obra t
            join public.traspaso_items ti on ti.traspaso_id = t.id
            where t.obra_origen_id = om.obra_id
              and ti.material_id = om.material_id
              and t.estado in ('en_transito', 'completado')
        ), 0::numeric)
        - (
            greatest(0, coalesce(ep.total_reservado_activo, 0) - coalesce(c.total_comprado, 0))
            + coalesce(sp.total_solicitado_pendiente, 0)
            + coalesce(c.total_comprado, 0)
        )
    )::numeric(12,2) as cantidad_disponible,

    -- Campos retrocompatibles
    coalesce(sum(om.cantidad_contratada), 0::numeric)::numeric(12,2) as cantidad_contratada,
    coalesce((
        select sum(r.cantidad)
        from public.solicitud_reservas_cantidad r
        where r.obra_id = om.obra_id
          and r.material_id = om.material_id
          and r.estado = 'aplicada'
    ), 0::numeric) as cantidad_usada,
    (
        greatest(0, coalesce(ep.total_reservado_activo, 0) - coalesce(c.total_comprado, 0))
        + coalesce(sp.total_solicitado_pendiente, 0)
    )::numeric(12,2) as cantidad_comprometida,

    -- Rubro y foto
    cm.categoria,
    cm.subcategoria,
    cm.foto_url
from obras_materiales om
left join en_proceso ep on ep.obra_id = om.obra_id and ep.material_id = om.material_id
left join solicitudes_pendientes sp on sp.obra_id = om.obra_id and sp.material_id = om.material_id
left join compras c on c.obra_id = om.obra_id and c.material_id = om.material_id
left join public.catalogo_materiales cm on cm.id = om.material_id
group by
    om.obra_id,
    om.material_id,
    cm.nombre_base,
    cm.variante,
    cm.unidad_medida,
    cm.categoria,
    cm.subcategoria,
    cm.foto_url,
    ep.total_reservado_activo,
    sp.total_solicitado_pendiente,
    c.total_comprado;

grant select on public.v_saldo_material_obra to authenticated;

commit;
