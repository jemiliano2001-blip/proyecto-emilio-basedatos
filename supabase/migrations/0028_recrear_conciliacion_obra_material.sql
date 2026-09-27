-- =====================================================================
-- MIGRACIÓN 0028 — Recrear v_conciliacion_obra_material
--
-- Bug: 0020 hace `drop view if exists public.v_saldo_material_obra cascade`.
-- El CASCADE también borra v_conciliacion_obra_material (depende de esa vista)
-- y ninguna migración posterior la recrea. Efecto: /obras/[id]/conciliacion
-- mostraba la tabla de materiales vacía (y el export salía sin materiales).
--
-- Definición copiada textualmente de 0013 (sección 4). Las columnas que usa
-- de v_saldo_material_obra (cantidad_contratada, traspasos_entrada/salida,
-- cantidad_usada, cantidad_comprometida, cantidad_disponible, nombre_base,
-- variante, unidad_medida) siguen existiendo en la versión de 0020.
--
-- Para verificar antes de aplicar si de verdad falta en el remoto:
--   select to_regclass('public.v_conciliacion_obra_material');  -- null = falta
-- =====================================================================

begin;

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

commit;
