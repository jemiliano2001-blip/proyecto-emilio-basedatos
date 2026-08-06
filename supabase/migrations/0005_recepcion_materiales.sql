-- =====================================================================
-- MIGRACIÓN 0005 — RECEPCIÓN / CHECKLIST DE MATERIALES (Fase 4)
-- Personal captura checklist; Compras (Talía) aprueba o rechaza.
-- Solo recepciones aprobadas afectan el avance de la OC.
-- Sin fotos en v1. Sin asignaciones_material (eso es Fase 5).
-- =====================================================================

create type estado_recepcion as enum (
    'pendiente_revision',
    'aprobada',
    'rechazada'
);

create type estado_recepcion_item as enum (
    'completo',
    'parcial',
    'faltante',
    'danado'
);

-- Trazabilidad pedido → cotización → OC (nullable para OCs ya emitidas)
alter table orden_compra_items
    add column if not exists cotizacion_item_id uuid references cotizacion_items(id);

create index if not exists idx_orden_compra_items_cotizacion_item
    on orden_compra_items(cotizacion_item_id);

-- =====================================================================
-- RECEPCIONES
-- id lo genera el cliente (idempotencia offline)
-- =====================================================================
create table recepciones_material (
    id                   uuid primary key,
    orden_id             uuid not null references ordenes_compra(id),
    receptor_id          uuid not null references usuarios(id),
    estado               estado_recepcion not null default 'pendiente_revision',
    referencia_entrega   text,
    nota                 text,
    recibido_en          timestamptz not null default now(),
    revisado_por         uuid references usuarios(id),
    revisado_en          timestamptz,
    nota_revision        text,
    creado_en            timestamptz not null default now(),
    constraint recepciones_material_revision_ck check (
        (estado = 'pendiente_revision' and revisado_por is null and revisado_en is null)
        or (estado in ('aprobada', 'rechazada') and revisado_por is not null and revisado_en is not null)
    )
);

create index idx_recepciones_material_orden on recepciones_material(orden_id);
create index idx_recepciones_material_estado on recepciones_material(estado);
create index idx_recepciones_material_receptor on recepciones_material(receptor_id);

create table recepcion_items (
    id                   uuid primary key default gen_random_uuid(),
    recepcion_id         uuid not null references recepciones_material(id) on delete restrict,
    orden_item_id        uuid not null references orden_compra_items(id),
    cantidad_recibida    numeric(12,2) not null check (cantidad_recibida >= 0),
    cantidad_danada      numeric(12,2) not null default 0 check (cantidad_danada >= 0),
    estado               estado_recepcion_item not null,
    observacion          text,
    creado_en            timestamptz not null default now(),
    unique (recepcion_id, orden_item_id),
    constraint recepcion_items_observacion_ck check (
        estado not in ('faltante', 'danado')
        or (observacion is not null and length(trim(observacion)) > 0)
    ),
    constraint recepcion_items_danado_ck check (
        cantidad_danada = 0
        or (observacion is not null and length(trim(observacion)) > 0)
    ),
    constraint recepcion_items_alguna_cantidad_ck check (
        cantidad_recibida > 0 or cantidad_danada > 0 or estado = 'faltante'
    )
);

create index idx_recepcion_items_recepcion on recepcion_items(recepcion_id);
create index idx_recepcion_items_orden_item on recepcion_items(orden_item_id);

alter table recepciones_material enable row level security;
alter table recepcion_items enable row level security;

-- Personal: propias; staff: todas
create policy recepciones_material_select on recepciones_material for select
    using (
        receptor_id = auth.uid()
        or auth_rol() in ('compras', 'operacion', 'proyectos', 'acceso_total')
    );

create policy recepciones_material_insert on recepciones_material for insert
    with check (
        receptor_id = auth.uid()
        and auth_rol() in ('personal', 'compras', 'acceso_total')
        and estado = 'pendiente_revision'
        and revisado_por is null
        and revisado_en is null
        and exists (
            select 1 from ordenes_compra oc
            where oc.id = recepciones_material.orden_id
              and oc.estado in ('emitida', 'parcialmente_recibida')
        )
    );

-- Sin UPDATE/DELETE directo: la revisión va por RPC security definer.
-- Correcciones = nuevo checklist (trazabilidad).

create policy recepcion_items_select on recepcion_items for select
    using (
        exists (
            select 1 from recepciones_material r
            where r.id = recepcion_items.recepcion_id
              and (
                  r.receptor_id = auth.uid()
                  or auth_rol() in ('compras', 'operacion', 'proyectos', 'acceso_total')
              )
        )
    );

create policy recepcion_items_insert on recepcion_items for insert
    with check (
        exists (
            select 1 from recepciones_material r
            where r.id = recepcion_items.recepcion_id
              and r.receptor_id = auth.uid()
              and r.estado = 'pendiente_revision'
              and auth_rol() in ('personal', 'compras', 'acceso_total')
        )
        and exists (
            select 1
            from recepciones_material r
            join orden_compra_items oci on oci.id = recepcion_items.orden_item_id
            where r.id = recepcion_items.recepcion_id
              and oci.orden_id = r.orden_id
        )
    );

-- =====================================================================
-- DELETE de OC emitida: solo si aún no hay recepciones
-- =====================================================================
drop policy if exists ordenes_compra_delete on ordenes_compra;

create policy ordenes_compra_delete on ordenes_compra for delete
    using (
        auth_rol() in ('compras', 'acceso_total')
        and estado = 'emitida'
        and not exists (
            select 1 from recepciones_material r
            where r.orden_id = ordenes_compra.id
        )
    );

-- =====================================================================
-- Vista de saldo por renglón (sin precios) — security definer vía owner
-- =====================================================================
create or replace view v_orden_item_saldo_recepcion
with (security_invoker = false)
as
select
    oci.id as orden_item_id,
    oci.orden_id,
    oc.folio,
    oc.obra_id,
    oc.estado as orden_estado,
    oci.material_id,
    cm.nombre_base,
    cm.variante,
    cm.unidad_medida,
    oci.cantidad as cantidad_pedida,
    coalesce(sum(ri.cantidad_recibida) filter (where r.estado = 'aprobada'), 0)::numeric(12,2)
        as cantidad_recibida_buena,
    coalesce(sum(ri.cantidad_danada) filter (where r.estado = 'aprobada'), 0)::numeric(12,2)
        as cantidad_danada_acum,
    greatest(
        oci.cantidad
        - coalesce(sum(ri.cantidad_recibida + ri.cantidad_danada) filter (where r.estado = 'aprobada'), 0),
        0
    )::numeric(12,2) as pendiente
from orden_compra_items oci
join ordenes_compra oc on oc.id = oci.orden_id
join catalogo_materiales cm on cm.id = oci.material_id
left join recepcion_items ri on ri.orden_item_id = oci.id
left join recepciones_material r on r.id = ri.recepcion_id
group by
    oci.id, oci.orden_id, oc.folio, oc.obra_id, oc.estado,
    oci.material_id, cm.nombre_base, cm.variante, cm.unidad_medida, oci.cantidad;

revoke all on v_orden_item_saldo_recepcion from public;
revoke all on v_orden_item_saldo_recepcion from anon;
revoke all on v_orden_item_saldo_recepcion from authenticated;

-- Cabecera de OC sin precios (para Personal)
create or replace function listar_ordenes_checklist()
returns table (
    id uuid,
    folio text,
    obra_id uuid,
    obra_nombre text,
    proveedor_nombre text,
    estado estado_orden_compra,
    creado_en timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null or auth_rol() is null then
        raise exception 'No autenticado.';
    end if;

    return query
    select
        oc.id,
        oc.folio,
        oc.obra_id,
        o.nombre,
        p.nombre,
        oc.estado,
        oc.creado_en
    from ordenes_compra oc
    join obras o on o.id = oc.obra_id
    join proveedores p on p.id = oc.proveedor_id
    where oc.estado in ('emitida', 'parcialmente_recibida', 'recibida')
    order by oc.creado_en desc;
end;
$$;

revoke all on function public.listar_ordenes_checklist() from public;
revoke all on function public.listar_ordenes_checklist() from anon;
grant execute on function public.listar_ordenes_checklist() to authenticated;

create or replace function detalle_orden_checklist(p_orden_id uuid)
returns table (
    orden_item_id uuid,
    material_id uuid,
    nombre_base text,
    variante text,
    unidad_medida text,
    cantidad_pedida numeric,
    cantidad_recibida_buena numeric,
    cantidad_danada_acum numeric,
    pendiente numeric,
    folio text,
    obra_id uuid,
    obra_nombre text,
    proveedor_nombre text,
    orden_estado estado_orden_compra
)
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null or auth_rol() is null then
        raise exception 'No autenticado.';
    end if;

    if p_orden_id is null then
        raise exception 'Orden no válida.';
    end if;

    return query
    select
        v.orden_item_id,
        v.material_id,
        v.nombre_base,
        v.variante,
        v.unidad_medida,
        v.cantidad_pedida,
        v.cantidad_recibida_buena,
        v.cantidad_danada_acum,
        v.pendiente,
        v.folio,
        v.obra_id,
        o.nombre,
        p.nombre,
        v.orden_estado
    from v_orden_item_saldo_recepcion v
    join ordenes_compra oc on oc.id = v.orden_id
    join obras o on o.id = v.obra_id
    join proveedores p on p.id = oc.proveedor_id
    where v.orden_id = p_orden_id
    order by v.nombre_base, v.variante nulls last;
end;
$$;

revoke all on function public.detalle_orden_checklist(uuid) from public;
revoke all on function public.detalle_orden_checklist(uuid) from anon;
grant execute on function public.detalle_orden_checklist(uuid) to authenticated;

-- =====================================================================
-- Crear recepción (atómica + idempotente por UUID de cliente)
-- =====================================================================
create or replace function crear_recepcion(
    p_id uuid,
    p_orden_id uuid,
    p_referencia_entrega text,
    p_nota text,
    p_recibido_en timestamptz,
    p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_rol rol_usuario := auth_rol();
    v_uid uuid := auth.uid();
    v_existente recepciones_material%rowtype;
    v_oc ordenes_compra%rowtype;
    v_item jsonb;
    v_orden_item_id uuid;
    v_cant_buena numeric(12,2);
    v_cant_danada numeric(12,2);
    v_estado estado_recepcion_item;
    v_obs text;
    v_oci orden_compra_items%rowtype;
    v_count int := 0;
begin
    if v_uid is null or v_rol is null then
        raise exception 'No autenticado.';
    end if;
    if v_rol not in ('personal', 'compras', 'acceso_total') then
        raise exception 'Sin permiso para registrar recepciones.';
    end if;
    if p_id is null or p_orden_id is null then
        raise exception 'Datos de recepción incompletos.';
    end if;
    if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
        raise exception 'La recepción debe tener al menos un renglón.';
    end if;
    if jsonb_array_length(p_items) > 100 then
        raise exception 'Demasiados renglones en una recepción.';
    end if;

    select * into v_existente from recepciones_material where id = p_id;
    if found then
        if v_existente.receptor_id <> v_uid and v_rol <> 'acceso_total' then
            raise exception 'Conflicto: esa recepción ya existe con otro receptor.';
        end if;
        if v_existente.orden_id <> p_orden_id then
            raise exception 'Conflicto: el UUID ya está ligado a otra orden.';
        end if;
        return v_existente.id;
    end if;

    select * into v_oc from ordenes_compra where id = p_orden_id for update;
    if not found then
        raise exception 'La orden de compra no existe.';
    end if;
    if v_oc.estado not in ('emitida', 'parcialmente_recibida') then
        raise exception 'Esta orden ya no admite recepciones.';
    end if;

    insert into recepciones_material (
        id, orden_id, receptor_id, estado, referencia_entrega, nota, recibido_en
    ) values (
        p_id,
        p_orden_id,
        v_uid,
        'pendiente_revision',
        nullif(trim(coalesce(p_referencia_entrega, '')), ''),
        nullif(trim(coalesce(p_nota, '')), ''),
        coalesce(p_recibido_en, now())
    );

    for v_item in select * from jsonb_array_elements(p_items)
    loop
        v_orden_item_id := (v_item->>'orden_item_id')::uuid;
        v_cant_buena := coalesce((v_item->>'cantidad_recibida')::numeric, 0);
        v_cant_danada := coalesce((v_item->>'cantidad_danada')::numeric, 0);
        v_estado := (v_item->>'estado')::estado_recepcion_item;
        v_obs := nullif(trim(coalesce(v_item->>'observacion', '')), '');

        if v_orden_item_id is null then
            raise exception 'Renglón sin orden_item_id.';
        end if;
        if v_cant_buena < 0 or v_cant_danada < 0 then
            raise exception 'Las cantidades no pueden ser negativas.';
        end if;
        if round(v_cant_buena, 2) <> v_cant_buena or round(v_cant_danada, 2) <> v_cant_danada then
            raise exception 'Las cantidades solo admiten 2 decimales.';
        end if;

        select * into v_oci from orden_compra_items
        where id = v_orden_item_id and orden_id = p_orden_id;
        if not found then
            raise exception 'Un renglón no pertenece a esta orden.';
        end if;

        insert into recepcion_items (
            recepcion_id, orden_item_id, cantidad_recibida, cantidad_danada, estado, observacion
        ) values (
            p_id, v_orden_item_id, v_cant_buena, v_cant_danada, v_estado, v_obs
        );

        v_count := v_count + 1;
    end loop;

    if v_count = 0 then
        raise exception 'La recepción debe tener al menos un renglón.';
    end if;

    insert into notificaciones (rol_destino, titulo, mensaje, tipo, referencia_id)
    values (
        'compras',
        'Checklist pendiente de revisión',
        'Hay una recepción pendiente de revisar para ' || v_oc.folio || '.',
        'checklist_pendiente',
        p_id
    );

    return p_id;
end;
$$;

revoke all on function public.crear_recepcion(uuid, uuid, text, text, timestamptz, jsonb) from public;
revoke all on function public.crear_recepcion(uuid, uuid, text, text, timestamptz, jsonb) from anon;
grant execute on function public.crear_recepcion(uuid, uuid, text, text, timestamptz, jsonb) to authenticated;

-- =====================================================================
-- Revisar recepción (atómica): aprueba/rechaza + recalcula estado OC
-- =====================================================================
create or replace function revisar_recepcion(
    p_recepcion_id uuid,
    p_aprobar boolean,
    p_nota text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_rol rol_usuario := auth_rol();
    v_uid uuid := auth.uid();
    v_rec recepciones_material%rowtype;
    v_oc ordenes_compra%rowtype;
    r_item record;
    v_hist numeric(12,2);
    v_pedida numeric(12,2);
    v_total_pedida numeric(12,2) := 0;
    v_nuevo_estado estado_orden_compra;
    v_nota text := nullif(trim(coalesce(p_nota, '')), '');
begin
    if v_uid is null or v_rol is null then
        raise exception 'No autenticado.';
    end if;
    if v_rol not in ('compras', 'acceso_total') then
        raise exception 'Solo Compras puede revisar recepciones.';
    end if;
    if p_recepcion_id is null or p_aprobar is null then
        raise exception 'Parámetros incompletos.';
    end if;
    if not p_aprobar and (v_nota is null or length(v_nota) = 0) then
        raise exception 'Al rechazar debes indicar una nota.';
    end if;

    select * into v_rec
    from recepciones_material
    where id = p_recepcion_id
    for update;

    if not found then
        raise exception 'La recepción no existe.';
    end if;
    if v_rec.estado <> 'pendiente_revision' then
        raise exception 'Esta recepción ya fue revisada.';
    end if;

    select * into v_oc
    from ordenes_compra
    where id = v_rec.orden_id
    for update;

    if not found then
        raise exception 'La orden asociada no existe.';
    end if;
    if v_oc.estado = 'cancelada' then
        raise exception 'No se puede revisar una recepción de una OC cancelada.';
    end if;

    if p_aprobar then
        for r_item in
            select ri.orden_item_id, ri.cantidad_recibida, ri.cantidad_danada
            from recepcion_items ri
            where ri.recepcion_id = p_recepcion_id
            for update
        loop
            select oci.cantidad into v_pedida
            from orden_compra_items oci
            where oci.id = r_item.orden_item_id
              and oci.orden_id = v_oc.id
            for update;

            if not found then
                raise exception 'Renglón de recepción no pertenece a la OC.';
            end if;

            select coalesce(sum(ri2.cantidad_recibida + ri2.cantidad_danada), 0)
            into v_hist
            from recepcion_items ri2
            join recepciones_material r2 on r2.id = ri2.recepcion_id
            where ri2.orden_item_id = r_item.orden_item_id
              and r2.estado = 'aprobada';

            if v_hist + r_item.cantidad_recibida + r_item.cantidad_danada > v_pedida then
                raise exception
                    'Sobre-recepción: el renglón excede lo pedido (pedido %, ya aprobado %, intento %).',
                    v_pedida, v_hist, r_item.cantidad_recibida + r_item.cantidad_danada;
            end if;
        end loop;
    end if;

    update recepciones_material
    set
        estado = case when p_aprobar then 'aprobada'::estado_recepcion else 'rechazada'::estado_recepcion end,
        revisado_por = v_uid,
        revisado_en = now(),
        nota_revision = v_nota
    where id = p_recepcion_id;

    if p_aprobar then
        -- Avance de OC: bueno+dañado cierra el renglón pedido.
        -- Solo la cantidad buena será usable en Fase 5 (asignación).
        select
            coalesce(sum(oci.cantidad), 0),
            coalesce(sum(coalesce(s.cantidad_cubierta, 0)), 0)
        into v_total_pedida, v_hist
        from orden_compra_items oci
        left join (
            select
                ri.orden_item_id,
                sum(ri.cantidad_recibida + ri.cantidad_danada) as cantidad_cubierta
            from recepcion_items ri
            join recepciones_material r on r.id = ri.recepcion_id
            where r.orden_id = v_oc.id
              and r.estado = 'aprobada'
            group by ri.orden_item_id
        ) s on s.orden_item_id = oci.id
        where oci.orden_id = v_oc.id;

        if v_hist <= 0 then
            v_nuevo_estado := 'emitida';
        elsif v_hist >= v_total_pedida then
            v_nuevo_estado := 'recibida';
        else
            v_nuevo_estado := 'parcialmente_recibida';
        end if;

        if v_oc.estado is distinct from v_nuevo_estado then
            update ordenes_compra
            set estado = v_nuevo_estado
            where id = v_oc.id;
        end if;
    end if;

    insert into notificaciones (usuario_id, titulo, mensaje, tipo, referencia_id)
    values (
        v_rec.receptor_id,
        case when p_aprobar then 'Recepción aprobada' else 'Recepción rechazada' end,
        case
            when p_aprobar then 'Compras aprobó tu checklist de ' || v_oc.folio || '.'
            else 'Compras rechazó tu checklist de ' || v_oc.folio || coalesce(': ' || v_nota, '.')
        end,
        case when p_aprobar then 'recepcion_aprobada' else 'discrepancia_recepcion' end,
        p_recepcion_id
    );
end;
$$;

revoke all on function public.revisar_recepcion(uuid, boolean, text) from public;
revoke all on function public.revisar_recepcion(uuid, boolean, text) from anon;
grant execute on function public.revisar_recepcion(uuid, boolean, text) to authenticated;

-- =====================================================================
-- AUDITORÍA
-- =====================================================================
create trigger trg_auditoria_recepciones_material
    after insert or update or delete on recepciones_material
    for each row execute function fn_auditoria();

create trigger trg_auditoria_recepcion_items
    after insert or update or delete on recepcion_items
    for each row execute function fn_auditoria();

-- =====================================================================
-- Listado / detalle sin precios (Personal no tiene SELECT en OC)
-- =====================================================================
create or replace view v_recepciones_lista
with (security_invoker = false)
as
select
    r.id,
    r.orden_id,
    r.receptor_id,
    r.estado,
    r.referencia_entrega,
    r.nota,
    r.recibido_en,
    r.revisado_por,
    r.revisado_en,
    r.nota_revision,
    r.creado_en,
    oc.folio as orden_folio,
    oc.estado as orden_estado,
    oc.obra_id,
    u.nombre as receptor_nombre
from recepciones_material r
join ordenes_compra oc on oc.id = r.orden_id
join usuarios u on u.id = r.receptor_id;

revoke all on v_recepciones_lista from public;
revoke all on v_recepciones_lista from anon;
revoke all on v_recepciones_lista from authenticated;

create or replace function listar_recepciones()
returns setof v_recepciones_lista
language plpgsql
security definer
set search_path = public
as $$
declare
    v_rol rol_usuario := auth_rol();
    v_uid uuid := auth.uid();
begin
    if v_uid is null or v_rol is null then
        raise exception 'No autenticado.';
    end if;

    if v_rol = 'personal' then
        return query
        select * from v_recepciones_lista v
        where v.receptor_id = v_uid
        order by v.creado_en desc
        limit 50;
    elsif v_rol in ('compras', 'operacion', 'proyectos', 'acceso_total') then
        return query
        select * from v_recepciones_lista v
        order by v.creado_en desc
        limit 50;
    else
        raise exception 'Sin permiso.';
    end if;
end;
$$;

revoke all on function public.listar_recepciones() from public;
revoke all on function public.listar_recepciones() from anon;
grant execute on function public.listar_recepciones() to authenticated;

create or replace function detalle_recepcion(p_recepcion_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_rol rol_usuario := auth_rol();
    v_uid uuid := auth.uid();
    v_rec recepciones_material%rowtype;
    v_result jsonb;
begin
    if v_uid is null or v_rol is null then
        raise exception 'No autenticado.';
    end if;
    if p_recepcion_id is null then
        raise exception 'Recepción no válida.';
    end if;

    select * into v_rec from recepciones_material where id = p_recepcion_id;
    if not found then
        return null;
    end if;

    if v_rol = 'personal' and v_rec.receptor_id <> v_uid then
        raise exception 'Sin permiso para ver esta recepción.';
    end if;
    if v_rol not in ('personal', 'compras', 'operacion', 'proyectos', 'acceso_total') then
        raise exception 'Sin permiso.';
    end if;

    select jsonb_build_object(
        'id', r.id,
        'estado', r.estado,
        'nota', r.nota,
        'referencia_entrega', r.referencia_entrega,
        'recibido_en', r.recibido_en,
        'revisado_en', r.revisado_en,
        'nota_revision', r.nota_revision,
        'orden', jsonb_build_object(
            'id', oc.id,
            'folio', oc.folio,
            'estado', oc.estado
        ),
        'receptor', jsonb_build_object('nombre', ur.nombre),
        'revisor', case when uj.id is null then null else jsonb_build_object('nombre', uj.nombre) end,
        'items', coalesce((
            select jsonb_agg(
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
                            'unidad_medida', cm.unidad_medida
                        )
                    )
                )
                order by cm.nombre_base
            )
            from recepcion_items ri
            join orden_compra_items oci on oci.id = ri.orden_item_id
            join catalogo_materiales cm on cm.id = oci.material_id
            where ri.recepcion_id = r.id
        ), '[]'::jsonb)
    )
    into v_result
    from recepciones_material r
    join ordenes_compra oc on oc.id = r.orden_id
    join usuarios ur on ur.id = r.receptor_id
    left join usuarios uj on uj.id = r.revisado_por
    where r.id = p_recepcion_id;

    return v_result;
end;
$$;

revoke all on function public.detalle_recepcion(uuid) from public;
revoke all on function public.detalle_recepcion(uuid) from anon;
grant execute on function public.detalle_recepcion(uuid) to authenticated;
