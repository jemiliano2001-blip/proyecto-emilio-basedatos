-- =====================================================================
-- MIGRACIÓN 0019 — Evidencias Fotográficas con Metadatos y Geolocalización
-- Fase 8: Trazabilidad Visual en Obra
-- 1. Tabla recepcion_fotos (asociada a recepciones_material y recepcion_items).
-- 2. Metadatos técnicos: latitud, longitud, precisión GPS, resolución y calidad.
-- 3. Actualización de RPC detalle_recepcion para devolver evidencias por ítem.
-- 4. Políticas RLS y Storage para subidas por personal en campo.
-- =====================================================================

-- 1. Tipos de evidencia fotográfica
do $$
begin
    if not exists (select 1 from pg_type where typname = 'tipo_foto_evidencia') then
        create type tipo_foto_evidencia as enum (
            'remision_documento',
            'material_completo',
            'etiqueta_placa',
            'dano_evidencia',
            'firma_chofer',
            'selfie_entrega'
        );
    end if;
end $$;

-- 2. Tabla recepcion_fotos
create table if not exists recepcion_fotos (
    id                   uuid primary key default gen_random_uuid(),
    recepcion_id         uuid not null references recepciones_material(id) on delete cascade,
    recepcion_item_id    uuid references recepcion_items(id) on delete set null,
    material_id          uuid references catalogo_materiales(id) on delete set null,
    tipo_foto            tipo_foto_evidencia not null default 'material_completo',
    storage_path         text not null,
    foto_url             text not null check (trim(foto_url) <> ''),
    capturado_por        uuid not null references usuarios(id),
    capturado_en         timestamptz not null default now(),
    latitud              numeric(10, 7),
    longitud             numeric(10, 7),
    precision_gps_m      numeric(6, 1),
    resolucion_px        text,
    tamano_bytes         integer check (tamano_bytes is null or tamano_bytes >= 0),
    calidad_score        numeric(3, 2) check (calidad_score is null or (calidad_score >= 0 and calidad_score <= 1)),
    notas                text,
    creado_en            timestamptz not null default now()
);

-- Índices de consulta rápida
create index if not exists idx_recepcion_fotos_recepcion
    on recepcion_fotos(recepcion_id);

create index if not exists idx_recepcion_fotos_item
    on recepcion_fotos(recepcion_item_id);

create index if not exists idx_recepcion_fotos_material
    on recepcion_fotos(material_id);

create index if not exists idx_recepcion_fotos_capturado_por
    on recepcion_fotos(capturado_por);

-- 3. RLS en recepcion_fotos
alter table recepcion_fotos enable row level security;

-- Lectura: los mismos roles autorizados a ver recepciones
create policy recepcion_fotos_select on recepcion_fotos
    for select using (
        capturado_por = auth.uid()
        or auth_rol() in ('compras', 'operacion', 'proyectos', 'acceso_total')
    );

-- Inserción: Personal, Compras y Acceso Total
create policy recepcion_fotos_insert on recepcion_fotos
    for insert with check (
        capturado_por = auth.uid()
        and auth_rol() in ('personal', 'compras', 'acceso_total')
    );

-- Trigger de auditoría
create trigger trg_auditoria_recepcion_fotos
    after insert or update or delete on recepcion_fotos
    for each row execute function fn_auditoria();

-- 4. Columna foto_url opcional en recepcion_items para acceso directo
alter table recepcion_items
    add column if not exists foto_url text;

comment on column recepcion_items.foto_url is 'URL rápida de fotografía directa del material o daño capturado en el checklist';

-- 5. Actualización de RPC detalle_recepcion para incluir el array de fotos
create or replace function detalle_recepcion(p_recepcion_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_rec record;
    v_items jsonb;
    v_fotos jsonb;
begin
    if not (auth_rol() in ('personal', 'compras', 'proyectos', 'operacion', 'acceso_total')) then
        raise exception 'No autorizado';
    end if;

    select
        r.id,
        r.estado,
        r.referencia_entrega,
        r.nota,
        r.recibido_en,
        r.revisado_en,
        r.nota_revision,
        r.foto_remision_url,
        r.foto_evidencia_url,
        jsonb_build_object(
            'id', oc.id,
            'folio', oc.folio,
            'estado', oc.estado
        ) as orden,
        jsonb_build_object(
            'id', u_rec.id,
            'nombre', u_rec.nombre
        ) as receptor,
        case when u_rev.id is not null then
            jsonb_build_object(
                'id', u_rev.id,
                'nombre', u_rev.nombre
            )
        else null end as revisor
    into v_rec
    from recepciones_material r
    join ordenes_compra oc on oc.id = r.orden_id
    join usuarios u_rec on u_rec.id = r.receptor_id
    left join usuarios u_rev on u_rev.id = r.revisado_por
    where r.id = p_recepcion_id;

    if v_rec.id is null then
        return null;
    end if;

    -- Colección de ítems con foto_url
    select coalesce(jsonb_agg(
        jsonb_build_object(
            'id', ri.id,
            'cantidad_recibida', ri.cantidad_recibida,
            'cantidad_danada', ri.cantidad_danada,
            'estado', ri.estado,
            'observacion', ri.observacion,
            'foto_url', ri.foto_url,
            'orden_item', jsonb_build_object(
                'cantidad', oci.cantidad,
                'material', jsonb_build_object(
                    'id', cm.id,
                    'nombre_base', cm.nombre_base,
                    'variante', cm.variante,
                    'unidad_medida', cm.unidad_medida,
                    'foto_url', cm.foto_url
                )
            )
        )
    ), '[]'::jsonb)
    into v_items
    from recepcion_items ri
    join orden_compra_items oci on oci.id = ri.orden_item_id
    join catalogo_materiales cm on cm.id = oci.material_id
    where ri.recepcion_id = p_recepcion_id;

    -- Colección de fotos con metadatos de la recepción
    select coalesce(jsonb_agg(
        jsonb_build_object(
            'id', rf.id,
            'tipo_foto', rf.tipo_foto,
            'foto_url', rf.foto_url,
            'recepcion_item_id', rf.recepcion_item_id,
            'material_id', rf.material_id,
            'capturado_en', rf.capturado_en,
            'latitud', rf.latitud,
            'longitud', rf.longitud,
            'precision_gps_m', rf.precision_gps_m,
            'resolucion_px', rf.resolucion_px,
            'tamano_bytes', rf.tamano_bytes,
            'calidad_score', rf.calidad_score,
            'notas', rf.notas
        ) order by rf.creado_en
    ), '[]'::jsonb)
    into v_fotos
    from recepcion_fotos rf
    where rf.recepcion_id = p_recepcion_id;

    return jsonb_build_object(
        'id', v_rec.id,
        'estado', v_rec.estado,
        'referencia_entrega', v_rec.referencia_entrega,
        'nota', v_rec.nota,
        'recibido_en', v_rec.recibido_en,
        'revisado_en', v_rec.revisado_en,
        'nota_revision', v_rec.nota_revision,
        'foto_remision_url', v_rec.foto_remision_url,
        'foto_evidencia_url', v_rec.foto_evidencia_url,
        'orden', v_rec.orden,
        'receptor', v_rec.receptor,
        'revisor', v_rec.revisor,
        'items', v_items,
        'fotos', v_fotos
    );
end;
$$;
