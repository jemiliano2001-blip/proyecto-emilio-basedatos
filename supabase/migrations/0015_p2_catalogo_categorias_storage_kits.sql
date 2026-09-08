-- =====================================================================
-- MIGRACIÓN 0015 — P2 Feedback Emilio Garza (ObraTrack)
-- 1. Categorías y subcategorías dinámicas en base de datos.
-- 2. Relajación de checks rígidos de 0006.
-- 3. Bucket de Supabase Storage 'materiales' y políticas RLS.
-- 4. Exposición de categoría, subcategoría y foto_url en v_saldo_material_obra.
-- =====================================================================

-- 1. Relajar los CHECKs fijos de la migración 0006
alter table catalogo_materiales
    drop constraint if exists catalogo_materiales_categoria_check;

alter table catalogo_materiales
    drop constraint if exists catalogo_materiales_subcategoria_par_check;

-- 2. Tablas para categorías y subcategorías dinámicas
create table if not exists material_categorias (
    id uuid primary key default gen_random_uuid(),
    nombre text not null unique check (trim(nombre) <> ''),
    orden int not null default 0,
    creado_en timestamptz not null default now()
);

create table if not exists material_subcategorias (
    id uuid primary key default gen_random_uuid(),
    categoria_id uuid not null references material_categorias(id) on delete cascade,
    nombre text not null check (trim(nombre) <> ''),
    orden int not null default 0,
    creado_en timestamptz not null default now(),
    unique (categoria_id, nombre)
);

create index if not exists idx_material_subcategorias_categoria_id
    on material_subcategorias(categoria_id);

-- RLS y Políticas de acceso
alter table material_categorias enable row level security;
alter table material_subcategorias enable row level security;

-- Lectura para todos los roles autenticados
create policy material_categorias_select on material_categorias
    for select using (auth.role() = 'authenticated');

create policy material_subcategorias_select on material_subcategorias
    for select using (auth.role() = 'authenticated');

-- Escritura solo para usuarios autorizados (proyectos y acceso_total)
create policy material_categorias_insert on material_categorias
    for insert with check (auth_rol() in ('acceso_total', 'proyectos'));

create policy material_categorias_update on material_categorias
    for update using (auth_rol() in ('acceso_total', 'proyectos'));

create policy material_categorias_delete on material_categorias
    for delete using (auth_rol() in ('acceso_total', 'proyectos'));

create policy material_subcategorias_insert on material_subcategorias
    for insert with check (auth_rol() in ('acceso_total', 'proyectos'));

create policy material_subcategorias_update on material_subcategorias
    for update using (auth_rol() in ('acceso_total', 'proyectos'));

create policy material_subcategorias_delete on material_subcategorias
    for delete using (auth_rol() in ('acceso_total', 'proyectos'));

-- Triggers de auditoría
create trigger trg_auditoria_material_categorias
    after insert or update or delete on material_categorias
    for each row execute function fn_auditoria();

create trigger trg_auditoria_material_subcategorias
    after insert or update or delete on material_subcategorias
    for each row execute function fn_auditoria();

-- 3. Siembra inicial de categorías y subcategorías actuales
insert into material_categorias (nombre, orden)
values 
    ('Obra Civil', 1),
    ('Electromecánico', 2)
on conflict (nombre) do nothing;

insert into material_subcategorias (categoria_id, nombre, orden)
select c.id, s.nombre, s.orden
from material_categorias c
cross join (
    values
        ('Registros', 1),
        ('Tubería', 2)
) as s(nombre, orden)
where c.nombre = 'Obra Civil'
on conflict (categoria_id, nombre) do nothing;

insert into material_subcategorias (categoria_id, nombre, orden)
select c.id, s.nombre, s.orden
from material_categorias c
cross join (
    values
        ('Transformadores', 1),
        ('Cableado', 2),
        ('Accesorios subterráneos', 3),
        ('Accesorios aéreos (herrajes)', 4),
        ('Alumbrado público', 5)
) as s(nombre, orden)
where c.nombre = 'Electromecánico'
on conflict (categoria_id, nombre) do nothing;

-- 4. Bucket de Supabase Storage para fotos de materiales
insert into storage.buckets (id, name, public)
values ('materiales', 'materiales', true)
on conflict (id) do update set public = true;

create policy "Materiales Fotos - Lectura Publica / Autenticada"
on storage.objects for select
using (bucket_id = 'materiales');

create policy "Materiales Fotos - Subida por Gestion Catalogo"
on storage.objects for insert
with check (
    bucket_id = 'materiales'
    and (
        auth_rol() in ('acceso_total', 'proyectos')
        or auth.role() = 'authenticated'
    )
);

create policy "Materiales Fotos - Actualizacion por Gestion Catalogo"
on storage.objects for update
using (
    bucket_id = 'materiales'
    and (
        auth_rol() in ('acceso_total', 'proyectos')
        or auth.role() = 'authenticated'
    )
);

create policy "Materiales Fotos - Eliminacion por Gestion Catalogo"
on storage.objects for delete
using (
    bucket_id = 'materiales'
    and (
        auth_rol() in ('acceso_total', 'proyectos')
        or auth.role() = 'authenticated'
    )
);

-- 5. Actualización de vista v_saldo_material_obra para incluir categoria, subcategoria y foto_url
create or replace view v_saldo_material_obra
with (security_invoker = true)
as
with
obras_materiales as (
    select
        obra_material_contratado.obra_id,
        obra_material_contratado.material_id,
        obra_material_contratado.cantidad_contratada
    from obra_material_contratado
    union
    select
        t.obra_destino_id as obra_id,
        ti.material_id,
        0::numeric as cantidad_contratada
    from traspasos_obra t
    join traspaso_items ti on ti.traspaso_id = t.id
    where t.estado = 'completado'
),
compras as (
    select
        oc.obra_id,
        oci.material_id,
        coalesce(sum(oci.cantidad), 0)::numeric(12,2) as total_comprado
    from orden_compra_items oci
    join ordenes_compra oc on oc.id = oci.orden_id
    where oc.estado in ('emitida', 'parcialmente_recibida', 'recibida')
    group by oc.obra_id, oci.material_id
),
en_proceso as (
    select
        r.obra_id,
        r.material_id,
        coalesce(sum(r.cantidad), 0)::numeric(12,2) as total_reservado_activo
    from solicitud_reservas_cantidad r
    where r.estado = 'activa'
    group by r.obra_id, r.material_id
)
select
    om.obra_id,
    om.material_id,
    cm.nombre_base,
    cm.variante,
    cm.unidad_medida,

    -- 1. Asignado (contratado)
    coalesce(sum(om.cantidad_contratada), 0::numeric)::numeric(12,2) as cantidad_asignada,

    -- Traspasos
    coalesce((
        select sum(ti.cantidad)
        from traspasos_obra t
        join traspaso_items ti on ti.traspaso_id = t.id
        where t.obra_destino_id = om.obra_id
          and ti.material_id = om.material_id
          and t.estado = 'completado'
    ), 0::numeric)::numeric(12,2) as traspasos_entrada,

    coalesce((
        select sum(ti.cantidad)
        from traspasos_obra t
        join traspaso_items ti on ti.traspaso_id = t.id
        where t.obra_origen_id = om.obra_id
          and ti.material_id = om.material_id
          and t.estado in ('en_transito', 'completado')
    ), 0::numeric)::numeric(12,2) as traspasos_salida,

    -- 2. En proceso de compra
    greatest(0, coalesce(ep.total_reservado_activo, 0) - coalesce(c.total_comprado, 0))::numeric(12,2) as cantidad_en_proceso,

    -- 3. Comprado
    coalesce(c.total_comprado, 0)::numeric(12,2) as cantidad_comprada,

    -- 4. Entregado en obra (aplicado físicamente)
    coalesce((
        select sum(r.cantidad)
        from solicitud_reservas_cantidad r
        where r.obra_id = om.obra_id
          and r.material_id = om.material_id
          and r.estado = 'aplicada'
    ), 0::numeric)::numeric(12,2) as cantidad_entregada,

    -- 5. Disponible = Asignado + Entradas - Salidas - (En proceso + Comprado)
    (
        coalesce(sum(om.cantidad_contratada), 0::numeric)
        + coalesce((
            select sum(ti.cantidad)
            from traspasos_obra t
            join traspaso_items ti on ti.traspaso_id = t.id
            where t.obra_destino_id = om.obra_id
              and ti.material_id = om.material_id
              and t.estado = 'completado'
        ), 0::numeric)
        - coalesce((
            select sum(ti.cantidad)
            from traspasos_obra t
            join traspaso_items ti on ti.traspaso_id = t.id
            where t.obra_origen_id = om.obra_id
              and ti.material_id = om.material_id
              and t.estado in ('en_transito', 'completado')
        ), 0::numeric)
        - (
            greatest(0, coalesce(ep.total_reservado_activo, 0) - coalesce(c.total_comprado, 0))
            + coalesce(c.total_comprado, 0)
        )
    )::numeric(12,2) as cantidad_disponible,

    -- Campos retrocompatibles
    coalesce(sum(om.cantidad_contratada), 0::numeric)::numeric(12,2) as cantidad_contratada,
    coalesce((
        select sum(r.cantidad)
        from solicitud_reservas_cantidad r
        where r.obra_id = om.obra_id
          and r.material_id = om.material_id
          and r.estado = 'aplicada'
    ), 0::numeric) as cantidad_usada,
    greatest(0, coalesce(ep.total_reservado_activo, 0) - coalesce(c.total_comprado, 0))::numeric(12,2) as cantidad_comprometida,

    -- Nuevas columnas de rubro y foto para control de obra
    cm.categoria,
    cm.subcategoria,
    cm.foto_url
from obras_materiales om
join catalogo_materiales cm on cm.id = om.material_id
left join compras c on c.obra_id = om.obra_id and c.material_id = om.material_id
left join en_proceso ep on ep.obra_id = om.obra_id and ep.material_id = om.material_id
group by
    om.obra_id,
    om.material_id,
    cm.nombre_base,
    cm.variante,
    cm.unidad_medida,
    c.total_comprado,
    ep.total_reservado_activo,
    cm.categoria,
    cm.subcategoria,
    cm.foto_url;

grant select on v_saldo_material_obra to authenticated;
