-- =====================================================================
-- MIGRACIÓN 0026 — Reencauce único de solicitudes del flujo retirado
-- Ninguna solicitud legacy vuelve a emitir una OC directa.
-- =====================================================================

begin;

-- El trigger de transiciones protege el flujo vigente; se deshabilita solo
-- durante este remapeo administrativo, dentro de la misma transacción.
alter table public.solicitudes_material disable trigger trg_solicitudes_material_before_update;

update public.solicitudes_material
set estado = 'recibida'
where estado in ('pendiente', 'en_cotizacion');

update public.solicitudes_material
set estado = 'finalizada'
where estado = 'aprobada';

alter table public.solicitudes_material enable trigger trg_solicitudes_material_before_update;

commit;
