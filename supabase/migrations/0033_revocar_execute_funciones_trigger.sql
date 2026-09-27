-- =====================================================================
-- MIGRACIÓN 0033 — Quitar EXECUTE público a las funciones de trigger de 0029/0030
--
-- El Security Advisor de Supabase marca como "ejecutables por anon/authenticated"
-- las funciones security definer nuevas. Son funciones de trigger: Postgres no deja
-- invocarlas como RPC, así que no era explotable, pero no tienen por qué estar
-- expuestas. El EXECUTE solo se valida al crear el trigger, no cuando dispara,
-- así que los triggers siguen funcionando igual.
-- =====================================================================

revoke execute on function public.fn_obra_material_contratado_candado_cierre() from public, anon, authenticated;
revoke execute on function public.fn_obras_piso_presupuesto() from public, anon, authenticated;
revoke execute on function public.fn_ordenes_compra_before_update() from public, anon, authenticated;
