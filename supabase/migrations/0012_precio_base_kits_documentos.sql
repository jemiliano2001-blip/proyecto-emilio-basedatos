-- =====================================================================
-- MIGRACIÓN 0012 — Catálogo con precio base, Kits/Ensambles y Documentos PDF de Obra
-- =====================================================================

-- 1. PRECIO BASE EN CATÁLOGO GENERAL DE MATERIALES
alter table catalogo_materiales
    add column if not exists precio_base numeric(12,2) not null default 0
        check (precio_base >= 0);

comment on column catalogo_materiales.precio_base is 'Precio base unitario de referencia en MXN';

-- 2. KITS Y ENSAMBLES DE MATERIALES (Plantillas Compuestas)
-- Permite agrupar materiales para configuración rápida (ej. Transformador 100 kVA -> De remate / De paso / Aéreo / Subterráneo)
create table if not exists material_kits (
    id                      uuid primary key default gen_random_uuid(),
    nombre                  text not null,
    material_principal_id   uuid references catalogo_materiales(id) on delete set null,
    configuracion           text, -- ej. 'De remate', 'De paso', 'Aéreo', 'Subterráneo'
    descripcion             text,
    activo                  boolean not null default true,
    creado_en               timestamptz not null default now()
);

create table if not exists material_kit_items (
    id              uuid primary key default gen_random_uuid(),
    kit_id          uuid not null references material_kits(id) on delete cascade,
    material_id     uuid not null references catalogo_materiales(id) on delete restrict,
    cantidad        numeric(12,2) not null check (cantidad > 0),
    creado_en       timestamptz not null default now(),
    unique (kit_id, material_id)
);

create index if not exists idx_material_kits_principal on material_kits(material_principal_id);
create index if not exists idx_material_kit_items_kit on material_kit_items(kit_id);
create index if not exists idx_material_kit_items_material on material_kit_items(material_id);

-- 3. DOCUMENTACIÓN ADICIONAL DE OBRA (PDFs: Presupuestos, Planos, Minutas, Conciliaciones)
create table if not exists obra_documentos (
    id              uuid primary key default gen_random_uuid(),
    obra_id         uuid not null references obras(id) on delete cascade,
    nombre          text not null,
    tipo_documento  text not null default 'general'
                        check (tipo_documento in ('presupuesto', 'conciliacion', 'plano', 'minuta', 'general', 'otro')),
    archivo_path    text not null, -- Ruta en el bucket de storage (ej. 'obras/{obra_id}/{uuid}.pdf')
    archivo_url     text not null, -- URL pública o firmada para visualización/descarga directa
    tamano_bytes    bigint check (tamano_bytes is null or tamano_bytes >= 0),
    subido_por      uuid references usuarios(id),
    creado_en       timestamptz not null default now()
);

create index if not exists idx_obra_documentos_obra on obra_documentos(obra_id);

-- 4. RLS Y PERMISOS

alter table material_kits enable row level security;
alter table material_kit_items enable row level security;
alter table obra_documentos enable row level security;

-- Kits: Todos los autenticados pueden ver; solo Proyectos, Operación y Acceso Total pueden gestionar
create policy material_kits_select on material_kits for select
    using (auth.uid() is not null);

create policy material_kits_insert on material_kits for insert
    with check (auth_rol() in ('proyectos', 'operacion', 'acceso_total'));

create policy material_kits_update on material_kits for update
    using (auth_rol() in ('proyectos', 'operacion', 'acceso_total'));

create policy material_kits_delete on material_kits for delete
    using (auth_rol() in ('proyectos', 'operacion', 'acceso_total'));

-- Kit Items:
create policy material_kit_items_select on material_kit_items for select
    using (auth.uid() is not null);

create policy material_kit_items_insert on material_kit_items for insert
    with check (auth_rol() in ('proyectos', 'operacion', 'acceso_total'));

create policy material_kit_items_update on material_kit_items for update
    using (auth_rol() in ('proyectos', 'operacion', 'acceso_total'));

create policy material_kit_items_delete on material_kit_items for delete
    using (auth_rol() in ('proyectos', 'operacion', 'acceso_total'));

-- Documentos de Obra:
-- Lectura: todos los autenticados (incluye residentes de campo para consulta en sitio)
create policy obra_documentos_select on obra_documentos for select
    using (auth.uid() is not null);

-- Inserción: Administradores y Personal de Oficina
create policy obra_documentos_insert on obra_documentos for insert
    with check (auth_rol() in ('acceso_total', 'operacion', 'proyectos', 'compras', 'finanzas'));

-- Eliminación: Administradores y Proyectos/Operación
create policy obra_documentos_delete on obra_documentos for delete
    using (auth_rol() in ('acceso_total', 'operacion', 'proyectos'));

-- 5. TRIGGERS DE AUDITORÍA
create trigger trg_auditoria_material_kits
    after insert or update or delete on material_kits
    for each row execute function fn_auditoria();

create trigger trg_auditoria_material_kit_items
    after insert or update or delete on material_kit_items
    for each row execute function fn_auditoria();

create trigger trg_auditoria_obra_documentos
    after insert or update or delete on obra_documentos
    for each row execute function fn_auditoria();

-- 6. CONFIGURACIÓN DEL BUCKET DE SUPABASE STORAGE (obra-documentos)
-- Si la extensión/esquema de storage está habilitada en la base de datos:
insert into storage.buckets (id, name, public)
values ('obra-documentos', 'obra-documentos', true)
on conflict (id) do update set public = true;

-- Políticas de Storage para el bucket obra-documentos
create policy "Documentos Obra - Acceso Publico / Autenticado de Lectura"
on storage.objects for select
using (bucket_id = 'obra-documentos' and auth.role() = 'authenticated');

create policy "Documentos Obra - Subida por Oficina"
on storage.objects for insert
with check (
    bucket_id = 'obra-documentos'
    and auth.role() = 'authenticated'
);

create policy "Documentos Obra - Eliminacion por Oficina"
on storage.objects for delete
using (
    bucket_id = 'obra-documentos'
    and auth.role() = 'authenticated'
);
