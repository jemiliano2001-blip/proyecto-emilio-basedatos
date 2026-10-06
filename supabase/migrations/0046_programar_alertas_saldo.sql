-- Programa la revisión de alertas de saldo (0045) cada 15 minutos con pg_cron.
-- Va aparte de 0045 porque habilita una extensión (cambio de infraestructura) y las pruebas locales no la tienen.
-- Reversión: select cron.unschedule('alertas-saldo');
begin;
create extension if not exists pg_cron;
select cron.schedule('alertas-saldo', '*/15 * * * *', $$select public.revisar_alertas_saldo()$$);
commit;
