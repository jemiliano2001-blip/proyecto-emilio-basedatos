-- =====================================================================
-- MIGRACIÓN 0014 — Facturas en Órdenes de Compra y Folio Físico
-- =====================================================================

-- 1. FOLIO FÍSICO / TALONARIO EN ÓRDENES DE COMPRA
-- Permite capturar opcionalmente el folio del papel membretado preimpreso (ej. 14329)
alter table ordenes_compra
    add column if not exists folio_fisico text;

comment on column ordenes_compra.folio_fisico is 'Número de folio físico o talonario preimpreso (ej. 14329)';

-- 2. TABLA PARA FACTURAS ADJUNTAS A ÓRDENES DE COMPRA (PDFs e Imágenes)
create table if not exists orden_compra_facturas (
    id              uuid primary key default gen_random_uuid(),
    orden_id        uuid not null references ordenes_compra(id) on delete cascade,
    obra_id         uuid not null references obras(id) on delete cascade,
    folio_factura   text, -- Folio fiscal UUID o número comercial de factura (ej. F-1234)
    monto_factura   numeric(14,2) check (monto_factura is null or monto_factura >= 0),
    archivo_path    text not null, -- Ruta en storage (ej. 'ordenes/{orden_id}/facturas/{uuid}.pdf')
    archivo_url     text not null, -- URL pública o firmada de descarga
    archivo_nombre  text not null, -- Nombre original del archivo subido
    tamano_bytes    bigint check (tamano_bytes is null or tamano_bytes >= 0),
    tipo_archivo    text not null default 'pdf'
                        check (tipo_archivo in ('pdf', 'imagen', 'xml', 'otro')),
    subido_por      uuid references usuarios(id),
    creado_en       timestamptz not null default now()
);

create index if not exists idx_orden_compra_facturas_orden
    on orden_compra_facturas(orden_id);

create index if not exists idx_orden_compra_facturas_obra
    on orden_compra_facturas(obra_id);

-- 3. RLS Y PERMISOS

alter table orden_compra_facturas enable row level security;

-- Lectura: roles de oficina y gestión
drop policy if exists orden_compra_facturas_select on orden_compra_facturas;
create policy orden_compra_facturas_select on orden_compra_facturas for select
    using (
        auth_rol() in (
            'compras', 'finanzas', 'operacion', 'proyectos', 'acceso_total'
        )
    );

-- Inserción: Compras, Finanzas y Acceso Total
drop policy if exists orden_compra_facturas_insert on orden_compra_facturas;
create policy orden_compra_facturas_insert on orden_compra_facturas for insert
    with check (
        auth_rol() in ('compras', 'finanzas', 'acceso_total')
    );

-- Eliminación: Compras, Finanzas y Acceso Total
drop policy if exists orden_compra_facturas_delete on orden_compra_facturas;
create policy orden_compra_facturas_delete on orden_compra_facturas for delete
    using (
        auth_rol() in ('compras', 'finanzas', 'acceso_total')
    );

-- Actualizar política de UPDATE en ordenes_compra para permitir que Finanzas también asigne proveedor/folio físico
drop policy if exists ordenes_compra_update on ordenes_compra;
create policy ordenes_compra_update on ordenes_compra for update
    using (
        auth_rol() in ('compras', 'finanzas', 'acceso_total')
    );

-- 4. TRIGGER DE AUDITORÍA
drop trigger if exists trg_auditoria_orden_compra_facturas on orden_compra_facturas;
create trigger trg_auditoria_orden_compra_facturas
    after insert or update or delete on orden_compra_facturas
    for each row execute function fn_auditoria();
