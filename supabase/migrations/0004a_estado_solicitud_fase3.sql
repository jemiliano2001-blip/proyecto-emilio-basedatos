-- =====================================================================
-- MIGRACIÓN 0004a — Ampliar estado_solicitud para Fase 3
-- Debe aplicarse en su propia transacción ANTES de 0004.
-- Postgres no permite usar valores nuevos de enum en la misma
-- transacción que el ALTER TYPE ADD VALUE.
-- =====================================================================

alter type estado_solicitud add value if not exists 'en_cotizacion';
alter type estado_solicitud add value if not exists 'aprobada';
alter type estado_solicitud add value if not exists 'rechazada';
