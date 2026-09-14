-- =====================================================================
-- MIGRACIÓN 0022 — Materiales ligados a facturas de OC
-- Tabla puente orden_compra_factura_items + RLS.
-- UI: accordion por factura con link PDF y materiales dentro.
--
-- NO APLICAR sin revisión de Emilio.
-- =====================================================================

begin;

create table if not exists public.orden_compra_factura_items (
    id              uuid primary key default gen_random_uuid(),
    factura_id      uuid not null references public.orden_compra_facturas(id) on delete cascade,
    orden_item_id   uuid not null references public.orden_compra_items(id) on delete cascade,
    creado_en       timestamptz not null default now(),
    unique (factura_id, orden_item_id)
);

create index if not exists orden_compra_factura_items_factura_idx
    on public.orden_compra_factura_items (factura_id);
create index if not exists orden_compra_factura_items_item_idx
    on public.orden_compra_factura_items (orden_item_id);

alter table public.orden_compra_factura_items enable row level security;

drop policy if exists ocf_items_select on public.orden_compra_factura_items;
create policy ocf_items_select on public.orden_compra_factura_items for select
    using (auth_rol() in ('acceso_total', 'compras', 'finanzas', 'operacion', 'proyectos'));

drop policy if exists ocf_items_insert on public.orden_compra_factura_items;
create policy ocf_items_insert on public.orden_compra_factura_items for insert
    with check (auth_rol() in ('acceso_total', 'compras', 'finanzas'));

drop policy if exists ocf_items_delete on public.orden_compra_factura_items;
create policy ocf_items_delete on public.orden_compra_factura_items for delete
    using (auth_rol() in ('acceso_total', 'compras', 'finanzas'));

-- Auditoría (misma función genérica si existe)
do $$
begin
    if exists (
        select 1 from pg_proc where proname = 'fn_auditoria'
    ) then
        drop trigger if exists trg_auditoria_orden_compra_factura_items
            on public.orden_compra_factura_items;
        create trigger trg_auditoria_orden_compra_factura_items
            after insert or update or delete on public.orden_compra_factura_items
            for each row execute function fn_auditoria();
    end if;
end $$;

commit;
