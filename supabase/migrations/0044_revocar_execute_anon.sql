-- Security Advisor: dos funciones security definer eran ejecutables por anon vía /rest/v1/rpc.
-- No era explotable (eliminar_item_solicitud valida auth.uid() y rol al inicio; fn_usuarios_before_update
-- es una función de trigger), pero no tienen por qué estar expuestas. Mismo patrón que 0033: el EXECUTE de
-- una función de trigger solo se valida al crear el trigger, no al dispararlo.
begin;

revoke all on function public.eliminar_item_solicitud(uuid, uuid) from public, anon;
grant execute on function public.eliminar_item_solicitud(uuid, uuid) to authenticated;

revoke all on function public.fn_usuarios_before_update() from public, anon, authenticated;

notify pgrst,'reload schema';
commit;
