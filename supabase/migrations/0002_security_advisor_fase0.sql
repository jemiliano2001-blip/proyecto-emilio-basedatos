-- =====================================================================
-- MIGRACIÓN 0002 — Hardening Security Advisor (Fase 0)
-- =====================================================================

alter view public.v_saldo_material_obra set (security_invoker = true);

revoke all on function public.auth_rol() from public;
revoke all on function public.auth_rol() from anon;
grant execute on function public.auth_rol() to authenticated;

revoke all on function public.fn_auditoria() from public;
revoke all on function public.fn_auditoria() from anon;
revoke all on function public.fn_auditoria() from authenticated;

grant select on public.v_saldo_material_obra to authenticated;
