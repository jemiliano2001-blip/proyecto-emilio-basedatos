-- Folio legible para OC + policies DELETE para rollback de borradores
create or replace function next_folio_orden_compra()
returns text
language sql
security definer
set search_path = public
as $$
  select 'OC-' || lpad(nextval('orden_compra_folio_seq')::text, 5, '0');
$$;

revoke all on function public.next_folio_orden_compra() from public;
revoke all on function public.next_folio_orden_compra() from anon;
grant execute on function public.next_folio_orden_compra() to authenticated;

create policy cotizaciones_delete on cotizaciones for delete
    using (auth_rol() in ('compras', 'acceso_total') and estado = 'borrador');

create policy ordenes_compra_delete on ordenes_compra for delete
    using (auth_rol() in ('compras', 'acceso_total') and estado = 'emitida');
