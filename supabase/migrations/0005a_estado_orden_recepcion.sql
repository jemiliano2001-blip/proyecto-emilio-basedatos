-- =====================================================================
-- MIGRACIÓN 0005a — Ampliar estado_orden_compra para Fase 4
-- Debe aplicarse en su propia transacción ANTES de 0005.
-- Postgres no permite usar valores nuevos de enum en la misma
-- transacción que el ALTER TYPE ADD VALUE.
-- =====================================================================

alter type estado_orden_compra add value if not exists 'parcialmente_recibida';
alter type estado_orden_compra add value if not exists 'recibida';
