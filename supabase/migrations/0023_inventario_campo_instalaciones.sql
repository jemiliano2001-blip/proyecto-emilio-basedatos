-- =====================================================================
-- MIGRACIÓN 0023 — Inventario en campo e instalaciones
-- Personal reporta material instalado por obra.
-- Pendiente instalar = recibido (recepciones aprobadas) - instalado.
--
-- Revisar antes de aplicar si el agente no lo aplica por MCP.
-- =====================================================================

begin;

create table if not exists public.obra_material_instalaciones (
    id              uuid primary key default gen_random_uuid(),
    obra_id         uuid not null references public.obras(id),
    material_id     uuid not null references public.catalogo_materiales(id),
    cantidad        numeric(12,2) not null check (cantidad > 0),
    nota            text,
    reportado_por   uuid not null references public.usuarios(id),
    reportado_en    timestamptz not null default now()
);

create index if not exists obra_material_instalaciones_obra_idx
    on public.obra_material_instalaciones (obra_id);
create index if not exists obra_material_instalaciones_obra_mat_idx
    on public.obra_material_instalaciones (obra_id, material_id);

alter table public.obra_material_instalaciones enable row level security;

drop policy if exists omi_select on public.obra_material_instalaciones;
create policy omi_select on public.obra_material_instalaciones for select
    using (
        auth_rol() in ('acceso_total', 'personal', 'compras', 'finanzas', 'operacion', 'proyectos')
    );

drop policy if exists omi_insert on public.obra_material_instalaciones;
create policy omi_insert on public.obra_material_instalaciones for insert
    with check (
        auth_rol() in ('acceso_total', 'personal', 'operacion', 'proyectos')
        and reportado_por = auth.uid()
    );

-- Vista: inventario de campo por obra/material
drop view if exists public.v_inventario_campo_obra;
create view public.v_inventario_campo_obra
with (security_invoker = true)
as
with recibido as (
    select
        oc.obra_id,
        oci.material_id,
        coalesce(sum(ri.cantidad_recibida), 0)::numeric(12,2) as cantidad_recibida
    from public.recepcion_items ri
    join public.recepciones_material r on r.id = ri.recepcion_id
    join public.ordenes_compra oc on oc.id = r.orden_id
    join public.orden_compra_items oci on oci.id = ri.orden_item_id
    where r.estado = 'aprobada'
      and oci.material_id is not null
    group by oc.obra_id, oci.material_id
),
instalado as (
    select
        obra_id,
        material_id,
        coalesce(sum(cantidad), 0)::numeric(12,2) as cantidad_instalada
    from public.obra_material_instalaciones
    group by obra_id, material_id
),
base as (
    select obra_id, material_id from recibido
    union
    select obra_id, material_id from instalado
)
select
    b.obra_id,
    b.material_id,
    cm.nombre_base,
    cm.variante,
    cm.unidad_medida,
    cm.categoria,
    cm.subcategoria,
    coalesce(r.cantidad_recibida, 0)::numeric(12,2) as cantidad_recibida,
    coalesce(i.cantidad_instalada, 0)::numeric(12,2) as cantidad_instalada,
    greatest(
        0,
        coalesce(r.cantidad_recibida, 0) - coalesce(i.cantidad_instalada, 0)
    )::numeric(12,2) as cantidad_pendiente_instalar
from base b
left join recibido r on r.obra_id = b.obra_id and r.material_id = b.material_id
left join instalado i on i.obra_id = b.obra_id and i.material_id = b.material_id
join public.catalogo_materiales cm on cm.id = b.material_id;

grant select on public.v_inventario_campo_obra to authenticated;

-- RPC: reportar instalación (valida no exceder pendiente)
create or replace function public.reportar_instalacion_material(
    p_obra_id uuid,
    p_material_id uuid,
    p_cantidad numeric,
    p_nota text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_rol rol_usuario := auth_rol();
    v_uid uuid := auth.uid();
    v_pendiente numeric(12,2);
    v_id uuid;
    v_nota text;
begin
    if v_uid is null or v_rol is null then
        raise exception 'No autenticado.';
    end if;
    if v_rol not in ('personal', 'operacion', 'proyectos', 'acceso_total') then
        raise exception 'No tienes permiso para reportar instalaciones.';
    end if;
    if p_cantidad is null or p_cantidad <= 0 then
        raise exception 'La cantidad instalada debe ser mayor a cero.';
    end if;

    select cantidad_pendiente_instalar into v_pendiente
    from v_inventario_campo_obra
    where obra_id = p_obra_id and material_id = p_material_id;

    if v_pendiente is null then
        raise exception 'No hay material recibido en este proyecto para instalar.';
    end if;
    if p_cantidad > v_pendiente then
        raise exception 'La cantidad supera lo pendiente de instalar (%).', v_pendiente;
    end if;

    v_nota := nullif(trim(coalesce(p_nota, '')), '');

    insert into obra_material_instalaciones (
        obra_id, material_id, cantidad, nota, reportado_por
    ) values (
        p_obra_id, p_material_id, round(p_cantidad, 2), v_nota, v_uid
    )
    returning id into v_id;

    return v_id;
end;
$$;

revoke all on function public.reportar_instalacion_material(uuid, uuid, numeric, text) from public;
revoke all on function public.reportar_instalacion_material(uuid, uuid, numeric, text) from anon;
grant execute on function public.reportar_instalacion_material(uuid, uuid, numeric, text) to authenticated;

do $$
begin
    if exists (select 1 from pg_proc where proname = 'fn_auditoria') then
        drop trigger if exists trg_auditoria_obra_material_instalaciones
            on public.obra_material_instalaciones;
        create trigger trg_auditoria_obra_material_instalaciones
            after insert or update or delete on public.obra_material_instalaciones
            for each row execute function fn_auditoria();
    end if;
end $$;

commit;
