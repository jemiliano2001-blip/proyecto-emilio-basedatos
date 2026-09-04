-- =====================================================================
-- MIGRACIÓN 0013 — Ciudad en Obras y Vista de Saldos con Nuevos Estados
-- =====================================================================

-- 1. COLUMNA CIUDAD EN OBRAS (ej. Matamoros, Reynosa, Querétaro)
alter table obras
    add column if not exists ciudad text;

comment on column obras.ciudad is 'Ciudad o municipio de la obra para logística y compras (ej. Matamoros)';

-- 2. REESTRUCTURACIÓN DE VISTAS CON DEPENDENCIAS (v_conciliacion_obra_material)
drop view if exists v_conciliacion_obra_material;
drop view if exists v_saldo_material_obra;

-- 3. VISTA v_saldo_material_obra ACTUALIZADA
-- Asignado (contratado)
-- Traspasos entrada y salida (Fase 6)
-- En proceso de compra (solicitudes activas no cubiertas aún por OC emitida)
-- Comprado (órdenes de compra emitidas o en recepción)
-- Entregado (material físicamente recibido y aplicado en sitio)
-- Disponible = Asignado + TraspasosEntrada - TraspasosSalida - (En proceso de compra + Comprado)

create or replace view v_saldo_material_obra
with (security_invoker = true)
as
with
obras_materiales as (
    select
        obra_material_contratado.obra_id,
        obra_material_contratado.material_id,
        obra_material_contratado.cantidad_contratada
    from obra_material_contratado
    union
    select
        t.obra_destino_id as obra_id,
        ti.material_id,
        0::numeric as cantidad_contratada
    from traspasos_obra t
    join traspaso_items ti on ti.traspaso_id = t.id
    where t.estado = 'completado'
),
-- Material comprado con Orden de Compra formal emitida o recibida
compras as (
    select
        oc.obra_id,
        oci.material_id,
        coalesce(sum(oci.cantidad), 0)::numeric(12,2) as total_comprado
    from orden_compra_items oci
    join ordenes_compra oc on oc.id = oci.orden_id
    where oc.estado in ('emitida', 'parcialmente_recibida', 'recibida')
    group by oc.obra_id, oci.material_id
),
-- Material en proceso de compra (solicitudes en curso / reservas activas que aún no están en OC)
en_proceso as (
    select
        r.obra_id,
        r.material_id,
        coalesce(sum(r.cantidad), 0)::numeric(12,2) as total_reservado_activo
    from solicitud_reservas_cantidad r
    where r.estado = 'activa'
    group by r.obra_id, r.material_id
)
select
    om.obra_id,
    om.material_id,
    cm.nombre_base,
    cm.variante,
    cm.unidad_medida,

    -- 1. Asignado (contratado)
    coalesce(sum(om.cantidad_contratada), 0::numeric)::numeric(12,2) as cantidad_asignada,

    -- Traspasos (Fase 6)
    coalesce((
        select sum(ti.cantidad)
        from traspasos_obra t
        join traspaso_items ti on ti.traspaso_id = t.id
        where t.obra_destino_id = om.obra_id
          and ti.material_id = om.material_id
          and t.estado = 'completado'
    ), 0::numeric)::numeric(12,2) as traspasos_entrada,

    coalesce((
        select sum(ti.cantidad)
        from traspasos_obra t
        join traspaso_items ti on ti.traspaso_id = t.id
        where t.obra_origen_id = om.obra_id
          and ti.material_id = om.material_id
          and t.estado in ('en_transito', 'completado')
    ), 0::numeric)::numeric(12,2) as traspasos_salida,

    -- 2. En proceso de compra
    greatest(0, coalesce(ep.total_reservado_activo, 0) - coalesce(c.total_comprado, 0))::numeric(12,2) as cantidad_en_proceso,

    -- 3. Comprado
    coalesce(c.total_comprado, 0)::numeric(12,2) as cantidad_comprada,

    -- 4. Entregado en obra (aplicado físicamente)
    coalesce((
        select sum(r.cantidad)
        from solicitud_reservas_cantidad r
        where r.obra_id = om.obra_id
          and r.material_id = om.material_id
          and r.estado = 'aplicada'
    ), 0::numeric)::numeric(12,2) as cantidad_entregada,

    -- 5. Disponible = Asignado + Entradas - Salidas - (En proceso + Comprado)
    (
        coalesce(sum(om.cantidad_contratada), 0::numeric)
        + coalesce((
            select sum(ti.cantidad)
            from traspasos_obra t
            join traspaso_items ti on ti.traspaso_id = t.id
            where t.obra_destino_id = om.obra_id
              and ti.material_id = om.material_id
              and t.estado = 'completado'
        ), 0::numeric)
        - coalesce((
            select sum(ti.cantidad)
            from traspasos_obra t
            join traspaso_items ti on ti.traspaso_id = t.id
            where t.obra_origen_id = om.obra_id
              and ti.material_id = om.material_id
              and t.estado in ('en_transito', 'completado')
        ), 0::numeric)
        - (
            greatest(0, coalesce(ep.total_reservado_activo, 0) - coalesce(c.total_comprado, 0))
            + coalesce(c.total_comprado, 0)
        )
    )::numeric(12,2) as cantidad_disponible,

    -- Campos retrocompatibles para código legacy y conciliación
    coalesce(sum(om.cantidad_contratada), 0::numeric)::numeric(12,2) as cantidad_contratada,
    coalesce((
        select sum(r.cantidad)
        from solicitud_reservas_cantidad r
        where r.obra_id = om.obra_id
          and r.material_id = om.material_id
          and r.estado = 'aplicada'
    ), 0::numeric) as cantidad_usada,
    greatest(0, coalesce(ep.total_reservado_activo, 0) - coalesce(c.total_comprado, 0))::numeric(12,2) as cantidad_comprometida
from obras_materiales om
join catalogo_materiales cm on cm.id = om.material_id
left join compras c on c.obra_id = om.obra_id and c.material_id = om.material_id
left join en_proceso ep on ep.obra_id = om.obra_id and ep.material_id = om.material_id
group by
    om.obra_id,
    om.material_id,
    cm.nombre_base,
    cm.variante,
    cm.unidad_medida,
    c.total_comprado,
    ep.total_reservado_activo;

grant select on v_saldo_material_obra to authenticated;

-- 4. RESTAURACIÓN DE VISTA v_conciliacion_obra_material (Fase 7)
create or replace view v_conciliacion_obra_material
with (security_invoker = true)
as
select
    sm.obra_id,
    sm.material_id,
    sm.nombre_base,
    sm.variante,
    sm.unidad_medida,
    cm.categoria,
    cm.subcategoria,
    sm.cantidad_contratada,
    sm.traspasos_entrada,
    sm.traspasos_salida,
    (sm.cantidad_contratada + sm.traspasos_entrada - sm.traspasos_salida)::numeric(12,2) as cantidad_tope_efectiva,
    sm.cantidad_usada,
    sm.cantidad_comprometida,
    sm.cantidad_disponible,
    coalesce((
        select sum(ri.cantidad_recibida)
        from recepcion_items ri
        join recepciones_material r on r.id = ri.recepcion_id
        join ordenes_compra oc on oc.id = r.orden_id
        join orden_compra_items oci on oci.id = ri.orden_item_id
        where oc.obra_id = sm.obra_id
          and oci.material_id = sm.material_id
          and r.estado = 'aprobada'
    ), 0)::numeric(12,2) as cantidad_recibida_buena_sitio,
    case
        when (sm.cantidad_contratada + sm.traspasos_entrada - sm.traspasos_salida) > 0
        then round(
            ((sm.cantidad_usada + sm.cantidad_comprometida) / (sm.cantidad_contratada + sm.traspasos_entrada - sm.traspasos_salida)) * 100,
            2
        )
        else 0
    end as porcentaje_ejecucion
from v_saldo_material_obra sm
join catalogo_materiales cm on cm.id = sm.material_id;

grant select on v_conciliacion_obra_material to authenticated;
