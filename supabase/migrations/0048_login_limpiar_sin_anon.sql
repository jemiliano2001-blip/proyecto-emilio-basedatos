-- Security Advisor (anon_security_definer_function_executable): login_limpiar
-- era ejecutable por anon, así que cualquiera con la anon key podía reiniciar su
-- propio contador vía /rest/v1/rpc/login_limpiar y anular el límite de 0040.
-- La app solo la llama tras un login exitoso, cuando la sesión ya es authenticated.
-- login_segundos_bloqueo y login_registrar_fallo siguen para anon: corren antes de autenticar.
begin;

revoke execute on function public.login_limpiar(text) from anon;

notify pgrst,'reload schema';
commit;
