-- =====================================================================
-- MIGRACIÓN 0006a — Nuevos valores de enum (transacción propia)
-- Postgres no permite usar valores nuevos de enum en la misma
-- transacción que el ALTER TYPE ADD VALUE.
-- =====================================================================

alter type rol_usuario add value if not exists 'finanzas';

alter type estado_solicitud add value if not exists 'recibida';
alter type estado_solicitud add value if not exists 'en_proceso';
alter type estado_solicitud add value if not exists 'finalizada';

create type tipo_linea_solicitud as enum (
    'material',
    'flete',
    'camiones',
    'mantenimiento',
    'otro'
);
