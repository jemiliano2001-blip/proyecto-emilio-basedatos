-- =====================================================================
-- MIGRACIÓN 0003 — SOLICITUDES DE CAMPO (Fase 2)
-- Personal levanta solicitudes de material por obra; Compras las atiende
-- a partir de Fase 3 (cotización). Aquí solo se cubre creación, consulta
-- y cancelación por parte de quien la creó — el flujo de cotización/
-- aprobación se agrega en una migración futura, cuando se construya
-- Fase 3, para no adelantar estados que todavía no existen en la app.
-- =====================================================================

-- Estado mínimo para Fase 2. Se amplía (p.ej. 'en_cotizacion', 'aprobada')
-- cuando se construya Fase 3 — no lo adelantamos aquí.
create type estado_solicitud as enum ('pendiente', 'cancelada');

create table solicitudes_material (
    id              uuid primary key default gen_random_uuid(),
    obra_id         uuid not null references obras(id),
    solicitante_id  uuid not null references usuarios(id),
    estado          estado_solicitud not null default 'pendiente',
    nota            text,
    creado_en       timestamptz not null default now(),
    cancelado_en    timestamptz
);

create index idx_solicitudes_material_obra on solicitudes_material(obra_id);
create index idx_solicitudes_material_solicitante on solicitudes_material(solicitante_id);
create index idx_solicitudes_material_estado on solicitudes_material(estado);

create table solicitud_items (
    id                      uuid primary key default gen_random_uuid(),
    solicitud_id            uuid not null references solicitudes_material(id) on delete cascade,
    material_id             uuid not null references catalogo_materiales(id),
    cantidad_solicitada     numeric(12,2) not null check (cantidad_solicitada > 0),
    nota                    text,
    creado_en               timestamptz not null default now(),
    unique (solicitud_id, material_id)
);

create index idx_solicitud_items_solicitud on solicitud_items(solicitud_id);

-- =====================================================================
-- RLS — activado desde este mismo commit, sin excepción
-- =====================================================================
alter table solicitudes_material enable row level security;
alter table solicitud_items enable row level security;

-- SOLICITUDES_MATERIAL
-- Personal ve solo las suyas; compras/proyectos/operacion/acceso_total
-- ven todas (las necesitan para dar seguimiento y, desde Fase 3, cotizar).
create policy solicitudes_material_select on solicitudes_material for select
    using (
        solicitante_id = auth.uid()
        or auth_rol() in ('compras', 'proyectos', 'operacion', 'acceso_total')
    );

-- Solo Personal puede levantar solicitudes, y solo a su propio nombre
-- (nunca en nombre de alguien más). acceso_total puede crear para pruebas
-- o soporte, igual que en el resto de las tablas.
create policy solicitudes_material_insert on solicitudes_material for insert
    with check (
        solicitante_id = auth.uid()
        and auth_rol() in ('personal', 'acceso_total')
    );

-- Única transición permitida en Fase 2: quien la creó puede cancelar su
-- propia solicitud mientras siga pendiente. acceso_total puede intervenir
-- en cualquier estado (soporte/corrección).
create policy solicitudes_material_update on solicitudes_material for update
    using (
        auth_rol() = 'acceso_total'
        or (solicitante_id = auth.uid() and estado = 'pendiente')
    )
    with check (
        auth_rol() = 'acceso_total'
        or (solicitante_id = auth.uid() and estado in ('pendiente', 'cancelada'))
    );

-- DELETE: dueño puede borrar su solicitud pendiente (rollback si fallan
-- los items); acceso_total siempre. Sin esto createSolicitudAction deja
-- solicitudes huérfanas cuando el insert de items falla.
create policy solicitudes_material_delete on solicitudes_material for delete
    using (
        auth_rol() = 'acceso_total'
        or (solicitante_id = auth.uid() and estado = 'pendiente')
    );

-- SOLICITUD_ITEMS — visibilidad y escritura heredan el permiso de la
-- solicitud a la que pertenecen.
create policy solicitud_items_select on solicitud_items for select
    using (
        exists (
            select 1 from solicitudes_material sm
            where sm.id = solicitud_items.solicitud_id
              and (
                  sm.solicitante_id = auth.uid()
                  or auth_rol() in ('compras', 'proyectos', 'operacion', 'acceso_total')
              )
        )
    );

create policy solicitud_items_insert on solicitud_items for insert
    with check (
        exists (
            select 1 from solicitudes_material sm
            where sm.id = solicitud_items.solicitud_id
              and sm.estado = 'pendiente'
              and (
                  sm.solicitante_id = auth.uid()
                  or auth_rol() = 'acceso_total'
              )
        )
    );

-- Sin policy de delete/update en items para Fase 2: para corregir una
-- solicitud, se cancela y se levanta una nueva. Evita ambigüedad sobre
-- qué se pidió originalmente si Compras ya la está viendo.

-- =====================================================================
-- TRIGGER: Personal solo puede cancelar (estado + cancelado_en).
-- No puede cambiar obra_id, solicitante_id, creado_en ni la nota vía UPDATE.
-- acceso_total puede corregir cualquier campo (soporte).
-- =====================================================================
create or replace function fn_solicitudes_material_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth_rol() = 'acceso_total' then
        return NEW;
    end if;

    -- Campos inmutables para no-admin
    if NEW.obra_id is distinct from OLD.obra_id
       or NEW.solicitante_id is distinct from OLD.solicitante_id
       or NEW.creado_en is distinct from OLD.creado_en
       or NEW.nota is distinct from OLD.nota then
        raise exception 'Solo se permite cancelar la solicitud (cambiar estado).';
    end if;

    -- Única transición válida: pendiente → cancelada
    if not (OLD.estado = 'pendiente' and NEW.estado = 'cancelada') then
        raise exception 'Transición de estado no permitida.';
    end if;

    if NEW.cancelado_en is null then
        NEW.cancelado_en := now();
    end if;

    return NEW;
end;
$$;

revoke all on function public.fn_solicitudes_material_before_update() from public;
revoke all on function public.fn_solicitudes_material_before_update() from anon;
revoke all on function public.fn_solicitudes_material_before_update() from authenticated;

create trigger trg_solicitudes_material_before_update
    before update on solicitudes_material
    for each row execute function fn_solicitudes_material_before_update();

-- =====================================================================
-- AUDITORÍA — igual que obras / obra_material_contratado en 0001
-- =====================================================================
create trigger trg_auditoria_solicitudes_material
    after insert or update or delete on solicitudes_material
    for each row execute function fn_auditoria();

create trigger trg_auditoria_solicitud_items
    after insert or update or delete on solicitud_items
    for each row execute function fn_auditoria();

-- =====================================================================
-- AJUSTE A usuarios_select (necesario para Fase 2)
-- La política original de 0001 solo dejaba ver el propio registro (o
-- todos, si acceso_total). Compras/Proyectos/Operación ahora necesitan
-- ver el nombre de quien levantó cada solicitud — es justo el "quién
-- hizo qué" que pidió Emilio en Fase 0. Se amplía a estos 3 roles;
-- Personal sigue viendo solo su propio registro.
-- =====================================================================
drop policy if exists usuarios_select on usuarios;

create policy usuarios_select on usuarios for select
    using (
        id = auth.uid()
        or auth_rol() in ('compras', 'proyectos', 'operacion', 'acceso_total')
    );

-- =====================================================================
-- AJUSTE A notificaciones (necesario para Fase 2)
-- Exigir perfil con rol válido (auth_rol() is not null), no solo sesión.
-- Evita que un auth.users sin fila en usuarios spamée notificaciones.
-- =====================================================================
create policy notificaciones_insert on notificaciones for insert
    with check (auth_rol() is not null);
