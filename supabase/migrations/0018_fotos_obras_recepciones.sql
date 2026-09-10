-- =====================================================================
-- MIGRACIÓN 0018 — Fotos en Proyectos y Evidencias Fotográficas de Recepción
-- 1. foto_url en obras (portada del proyecto).
-- 2. foto_remision_url y foto_evidencia_url en recepciones_material.
-- 3. Actualización de detalle_recepcion RPC para incluir fotos.
-- 4. Permisos de Storage para subidas en carpetas obras/ y recepciones/.
-- =====================================================================

-- 1. Portada del proyecto en obras
alter table obras
    add column if not exists foto_url text;

comment on column obras.foto_url is 'URL pública de la fotografía de portada o plano del proyecto';

-- 2. Evidencias en recepciones_material
alter table recepciones_material
    add column if not exists foto_remision_url text;

alter table recepciones_material
    add column if not exists foto_evidencia_url text;

comment on column recepciones_material.foto_remision_url is 'URL de la fotografía de la remisión física o guía de entrega del proveedor';
comment on column recepciones_material.foto_evidencia_url is 'URL de la fotografía de evidencia física o material dañado recibido en obra';

-- 3. Actualización de RPC detalle_recepcion para devolver las URLs de fotos
create or replace function detalle_recepcion(p_recepcion_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_rec record;
    v_items jsonb;
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

    select coalesce(jsonb_agg(
        jsonb_build_object(
            'id', ri.id,
            'cantidad_recibida', ri.cantidad_recibida,
            'cantidad_danada', ri.cantidad_danada,
            'estado', ri.estado,
            'observacion', ri.observacion,
            'orden_item', jsonb_build_object(
                'cantidad', oci.cantidad,
                'material', jsonb_build_object(
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
        'items', v_items
    );
end;
$$;

-- 4. Políticas de Storage en bucket 'materiales' para carpetas obras/ y recepciones/
do $$
begin
    if exists (select 1 from storage.buckets where id = 'materiales') then
        if not exists (
            select 1 from pg_policies 
            where schemaname = 'storage' and tablename = 'objects' and policyname = 'Materiales Fotos - Subida General Autenticada'
        ) then
            create policy "Materiales Fotos - Subida General Autenticada"
            on storage.objects for insert
            with check (
                bucket_id = 'materiales'
                and auth.role() = 'authenticated'
            );
        end if;
    end if;
end $$;
