-- =====================================================================
-- MIGRACIÓN 0004 — COTIZACIÓN Y ÓRDENES DE COMPRA (Fase 3)
-- Compras (Talía) cotiza solicitudes pendientes y emite órdenes de compra.
-- Personal NO ve precios ni OC — solo el estado de su solicitud.
-- Recepción/checklist queda para Fase 4.
--
-- NOTA: los valores nuevos de estado_solicitud (en_cotizacion, aprobada,
-- rechazada) se agregan en 0004a_estado_solicitud_fase3.sql en una
-- transacción separada — Postgres exige commit antes de usarlos.
-- =====================================================================

create type estado_cotizacion as enum ('borrador', 'enviada', 'aprobada', 'rechazada');
create type estado_orden_compra as enum ('emitida', 'cancelada');
create type moneda_oc as enum ('MXN', 'USD');

-- =====================================================================
-- PROVEEDORES
-- =====================================================================
create table proveedores (
    id              uuid primary key default gen_random_uuid(),
    nombre          text not null,
    contacto        text,
    telefono        text,
    activo          boolean not null default true,
    creado_en       timestamptz not null default now(),
    unique (nombre)
);

alter table proveedores enable row level security;

create policy proveedores_select on proveedores for select
    using (auth.uid() is not null);

create policy proveedores_insert on proveedores for insert
    with check (auth_rol() in ('compras', 'acceso_total'));

create policy proveedores_update on proveedores for update
    using (auth_rol() in ('compras', 'acceso_total'));

-- =====================================================================
-- COTIZACIONES
-- =====================================================================
create table cotizaciones (
    id              uuid primary key default gen_random_uuid(),
    solicitud_id    uuid not null references solicitudes_material(id),
    cotizador_id    uuid not null references usuarios(id),
    estado          estado_cotizacion not null default 'borrador',
    nota            text,
    creado_en       timestamptz not null default now(),
    actualizado_en  timestamptz not null default now()
);

create index idx_cotizaciones_solicitud on cotizaciones(solicitud_id);
create index idx_cotizaciones_estado on cotizaciones(estado);

create table cotizacion_items (
    id                  uuid primary key default gen_random_uuid(),
    cotizacion_id       uuid not null references cotizaciones(id) on delete cascade,
    solicitud_item_id   uuid not null references solicitud_items(id),
    proveedor_id        uuid not null references proveedores(id),
    precio_unitario     numeric(12,2) not null check (precio_unitario >= 0),
    cantidad            numeric(12,2) not null check (cantidad > 0),
    moneda              moneda_oc not null default 'MXN',
    creado_en           timestamptz not null default now(),
    unique (cotizacion_id, solicitud_item_id)
);

create index idx_cotizacion_items_cotizacion on cotizacion_items(cotizacion_id);

alter table cotizaciones enable row level security;
alter table cotizacion_items enable row level security;

-- Precios: solo compras/operacion/proyectos/acceso_total
create policy cotizaciones_select on cotizaciones for select
    using (auth_rol() in ('compras', 'operacion', 'proyectos', 'acceso_total'));

create policy cotizaciones_insert on cotizaciones for insert
    with check (
        cotizador_id = auth.uid()
        and auth_rol() in ('compras', 'acceso_total')
    );

create policy cotizaciones_update on cotizaciones for update
    using (auth_rol() in ('compras', 'acceso_total'));

create policy cotizacion_items_select on cotizacion_items for select
    using (auth_rol() in ('compras', 'operacion', 'proyectos', 'acceso_total'));

create policy cotizacion_items_insert on cotizacion_items for insert
    with check (
        exists (
            select 1 from cotizaciones c
            where c.id = cotizacion_items.cotizacion_id
              and c.estado = 'borrador'
              and auth_rol() in ('compras', 'acceso_total')
        )
    );

create policy cotizacion_items_update on cotizacion_items for update
    using (
        exists (
            select 1 from cotizaciones c
            where c.id = cotizacion_items.cotizacion_id
              and c.estado = 'borrador'
              and auth_rol() in ('compras', 'acceso_total')
        )
    );

create policy cotizacion_items_delete on cotizacion_items for delete
    using (
        exists (
            select 1 from cotizaciones c
            where c.id = cotizacion_items.cotizacion_id
              and c.estado = 'borrador'
              and auth_rol() in ('compras', 'acceso_total')
        )
    );

-- =====================================================================
-- ÓRDENES DE COMPRA
-- =====================================================================
create sequence orden_compra_folio_seq start 1;

create table ordenes_compra (
    id              uuid primary key default gen_random_uuid(),
    folio           text not null unique,
    cotizacion_id   uuid not null references cotizaciones(id),
    proveedor_id    uuid not null references proveedores(id),
    obra_id         uuid not null references obras(id),
    estado          estado_orden_compra not null default 'emitida',
    total           numeric(14,2) not null check (total >= 0),
    moneda          moneda_oc not null default 'MXN',
    creado_por      uuid not null references usuarios(id),
    creado_en       timestamptz not null default now()
);

create index idx_ordenes_compra_obra on ordenes_compra(obra_id);
create index idx_ordenes_compra_estado on ordenes_compra(estado);

create table orden_compra_items (
    id                  uuid primary key default gen_random_uuid(),
    orden_id            uuid not null references ordenes_compra(id) on delete cascade,
    material_id         uuid not null references catalogo_materiales(id),
    cantidad            numeric(12,2) not null check (cantidad > 0),
    precio_unitario     numeric(12,2) not null check (precio_unitario >= 0),
    subtotal            numeric(14,2) not null check (subtotal >= 0),
    creado_en           timestamptz not null default now()
);

create index idx_orden_compra_items_orden on orden_compra_items(orden_id);

alter table ordenes_compra enable row level security;
alter table orden_compra_items enable row level security;

create policy ordenes_compra_select on ordenes_compra for select
    using (auth_rol() in ('compras', 'operacion', 'proyectos', 'acceso_total'));

create policy ordenes_compra_insert on ordenes_compra for insert
    with check (
        creado_por = auth.uid()
        and auth_rol() in ('compras', 'acceso_total')
    );

create policy ordenes_compra_update on ordenes_compra for update
    using (auth_rol() in ('compras', 'acceso_total'));

create policy orden_compra_items_select on orden_compra_items for select
    using (auth_rol() in ('compras', 'operacion', 'proyectos', 'acceso_total'));

create policy orden_compra_items_insert on orden_compra_items for insert
    with check (
        exists (
            select 1 from ordenes_compra oc
            where oc.id = orden_compra_items.orden_id
              and auth_rol() in ('compras', 'acceso_total')
        )
    );

-- =====================================================================
-- TRANSICIONES DE ESTADO DE SOLICITUD (Fase 3)
-- Reemplaza el trigger de Fase 2: Personal solo cancela;
-- compras/acceso_total mueven pendiente → en_cotizacion → aprobada|rechazada.
-- =====================================================================
create or replace function fn_solicitudes_material_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    rol rol_usuario := auth_rol();
begin
    if rol = 'acceso_total' then
        return NEW;
    end if;

    -- Campos inmutables para no-admin
    if NEW.obra_id is distinct from OLD.obra_id
       or NEW.solicitante_id is distinct from OLD.solicitante_id
       or NEW.creado_en is distinct from OLD.creado_en then
        raise exception 'No se pueden modificar obra, solicitante ni fecha de creación.';
    end if;

    -- Personal: solo cancelar propia pendiente
    if rol = 'personal' then
        if NEW.nota is distinct from OLD.nota then
            raise exception 'Solo se permite cancelar la solicitud.';
        end if;
        if not (OLD.estado = 'pendiente' and NEW.estado = 'cancelada') then
            raise exception 'Transición de estado no permitida.';
        end if;
        if NEW.cancelado_en is null then
            NEW.cancelado_en := now();
        end if;
        return NEW;
    end if;

    -- Compras: transiciones de cotización/aprobación
    if rol = 'compras' then
        if NEW.nota is distinct from OLD.nota and NEW.estado is not distinct from OLD.estado then
            -- permitir nota solo si también cambia estado vía flujo controlado — bloquear nota sola
            raise exception 'Compras no puede editar la nota de la solicitud.';
        end if;
        if (OLD.estado = 'pendiente' and NEW.estado = 'en_cotizacion')
           or (OLD.estado = 'en_cotizacion' and NEW.estado in ('aprobada', 'rechazada'))
           or (OLD.estado = 'pendiente' and NEW.estado = 'rechazada') then
            return NEW;
        end if;
        raise exception 'Transición de estado no permitida para compras.';
    end if;

    raise exception 'Sin permiso para actualizar esta solicitud.';
end;
$$;

-- Ampliar policy UPDATE de solicitudes para que compras pueda mover estados
drop policy if exists solicitudes_material_update on solicitudes_material;

create policy solicitudes_material_update on solicitudes_material for update
    using (
        auth_rol() = 'acceso_total'
        or (solicitante_id = auth.uid() and estado = 'pendiente')
        or (auth_rol() = 'compras' and estado in ('pendiente', 'en_cotizacion'))
    )
    with check (
        auth_rol() = 'acceso_total'
        or (solicitante_id = auth.uid() and estado in ('pendiente', 'cancelada'))
        or (auth_rol() = 'compras' and estado in ('pendiente', 'en_cotizacion', 'aprobada', 'rechazada'))
    );

-- =====================================================================
-- AUDITORÍA — tablas con dinero / proveedores
-- =====================================================================
create trigger trg_auditoria_proveedores
    after insert or update or delete on proveedores
    for each row execute function fn_auditoria();

create trigger trg_auditoria_cotizaciones
    after insert or update or delete on cotizaciones
    for each row execute function fn_auditoria();

create trigger trg_auditoria_cotizacion_items
    after insert or update or delete on cotizacion_items
    for each row execute function fn_auditoria();

create trigger trg_auditoria_ordenes_compra
    after insert or update or delete on ordenes_compra
    for each row execute function fn_auditoria();

create trigger trg_auditoria_orden_compra_items
    after insert or update or delete on orden_compra_items
    for each row execute function fn_auditoria();
