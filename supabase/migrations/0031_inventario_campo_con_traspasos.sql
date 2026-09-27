-- =====================================================================
-- MIGRACIÓN 0031 — Inventario de campo considera traspasos entre obras
--
-- Problema: v_inventario_campo_obra (0023) calculaba "recibido en sitio" solo con
-- recepciones de órdenes de compra. Resultado:
--  * lo que llega a una obra por traspaso no se podía reportar como instalado
--    (reportar_instalacion_material lo rechazaba: "no hay material recibido");
--  * lo que sale de una obra por traspaso seguía contando como pendiente de
--    instalar, y se podía reportar instalado material que ya no está ahí.
--
-- Criterio físico (esto es inventario en sitio, no saldo contable):
--  * Entrada: traspasos 'completado' (el destino confirmó que lo recibió).
--  * Salida: traspasos 'en_transito' o 'completado' (ya salió de la obra origen).
--
-- Columnas existentes sin cambio de significado (cantidad_recibida sigue siendo
-- solo compras). Se agregan al final traspasos_entrada y traspasos_salida, y
-- cantidad_pendiente_instalar pasa a ser:
--   recibido + traspasos_entrada - traspasos_salida - instalado  (mínimo 0)
--
-- reportar_instalacion_material (0023) lee cantidad_pendiente_instalar de esta
-- vista, así que queda corregida sin tocarla.
-- =====================================================================

begin;

drop view if exists public.v_inventario_campo_obra;
create view public.v_inventario_campo_obra
with (security_invoker = true)
as
with recibido as (
    select
        oc.obra_id,
        oci.material_id,
        coalesce(sum(ri.cantidad_recibida), 0)::numeric(12,2) as cantidad_recibida
    from public.recepcion_items ri
    join public.recepciones_material r on r.id = ri.recepcion_id
    join public.ordenes_compra oc on oc.id = r.orden_id
    join public.orden_compra_items oci on oci.id = ri.orden_item_id
    where r.estado = 'aprobada'
      and oci.material_id is not null
    group by oc.obra_id, oci.material_id
),
entradas as (
    select
        t.obra_destino_id as obra_id,
        ti.material_id,
        coalesce(sum(ti.cantidad), 0)::numeric(12,2) as cantidad
    from public.traspasos_obra t
    join public.traspaso_items ti on ti.traspaso_id = t.id
    where t.estado = 'completado'
    group by t.obra_destino_id, ti.material_id
),
salidas as (
    select
        t.obra_origen_id as obra_id,
        ti.material_id,
        coalesce(sum(ti.cantidad), 0)::numeric(12,2) as cantidad
    from public.traspasos_obra t
    join public.traspaso_items ti on ti.traspaso_id = t.id
    where t.estado in ('en_transito', 'completado')
    group by t.obra_origen_id, ti.material_id
),
instalado as (
    select
        obra_id,
        material_id,
        coalesce(sum(cantidad), 0)::numeric(12,2) as cantidad_instalada
    from public.obra_material_instalaciones
    group by obra_id, material_id
),
base as (
    select obra_id, material_id from recibido
    union
    select obra_id, material_id from entradas
    union
    select obra_id, material_id from salidas
    union
    select obra_id, material_id from instalado
)
select
    b.obra_id,
    b.material_id,
    cm.nombre_base,
    cm.variante,
    cm.unidad_medida,
    cm.categoria,
    cm.subcategoria,
    coalesce(r.cantidad_recibida, 0)::numeric(12,2) as cantidad_recibida,
    coalesce(i.cantidad_instalada, 0)::numeric(12,2) as cantidad_instalada,
    greatest(
        0,
        coalesce(r.cantidad_recibida, 0)
          + coalesce(e.cantidad, 0)
          - coalesce(s.cantidad, 0)
          - coalesce(i.cantidad_instalada, 0)
    )::numeric(12,2) as cantidad_pendiente_instalar,
    coalesce(e.cantidad, 0)::numeric(12,2) as traspasos_entrada,
    coalesce(s.cantidad, 0)::numeric(12,2) as traspasos_salida
from base b
left join recibido r on r.obra_id = b.obra_id and r.material_id = b.material_id
left join entradas e on e.obra_id = b.obra_id and e.material_id = b.material_id
left join salidas s on s.obra_id = b.obra_id and s.material_id = b.material_id
left join instalado i on i.obra_id = b.obra_id and i.material_id = b.material_id
join public.catalogo_materiales cm on cm.id = b.material_id;

grant select on public.v_inventario_campo_obra to authenticated;

commit;
