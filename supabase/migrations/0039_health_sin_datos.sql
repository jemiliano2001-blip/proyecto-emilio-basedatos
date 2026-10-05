-- /api/health comprueba conectividad sin sesión y solo consulta count(id).
-- 0035 revocó SELECT de tablas base: restaurar esta operación sin filas/dinero.
-- authenticated no hereda anon (verificado en el remoto antes de aplicar).
begin;
create policy obras_health_anon_sin_filas on public.obras
  as restrictive for select to anon using (false);
grant select(id) on public.obras to anon;
notify pgrst,'reload schema';
commit;
