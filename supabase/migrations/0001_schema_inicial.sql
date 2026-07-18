-- =====================================================================
-- MIGRACIÓN 0001 — ESQUEMA INICIAL
-- Fase 1: Usuarios, Obras, Catálogo de Materiales, Topes por obra
-- =====================================================================

create extension if not exists "pgcrypto";

-- =====================================================================
-- USUARIOS Y ROLES
-- Cada persona tiene su propio login (login individual, no compartido)
-- =====================================================================
create type rol_usuario as enum ('personal', 'compras', 'proyectos', 'operacion', 'acceso_total');

create table usuarios (
    id              uuid primary key references auth.users(id) on delete cascade,
    nombre          text not null,
    rol             rol_usuario not null,
    activo          boolean not null default true,
    creado_en       timestamptz not null default now()
);

-- Función auxiliar: obtiene el rol del usuario autenticado actual
-- (se usa en las políticas de RLS de toda la app)
create or replace function auth_rol()
returns rol_usuario
language sql stable
security definer
set search_path = public
as $$
    select rol from usuarios where id = auth.uid();
$$;

-- =====================================================================
-- OBRAS
-- =====================================================================
create table obras (
    id              uuid primary key default gen_random_uuid(),
    nombre          text not null,
    fraccionamiento text,
    paquete         text,
    ubicacion       text,
    estado          text not null default 'activa'
                        check (estado in ('activa','pausada','cerrada')),
    creado_en       timestamptz not null default now(),
    cerrado_en      timestamptz
);

-- =====================================================================
-- CATALOGO_MATERIALES
-- =====================================================================
create table catalogo_materiales (
    id              uuid primary key default gen_random_uuid(),
    nombre_base     text not null,              -- ej. "REGISTRO"
    variante        text,                        -- ej. "CUADRADO" / "CUBETA"
    unidad_medida   text not null,               -- MTS, PZA, KG...
    categoria       text,                        -- OBRA CIVIL / ELECTROMECANICO
    subcategoria    text,                        -- Media Tensión / Baja Tensión / Alumbrado
    especificacion  text,
    foto_url        text,                        -- catálogo visual (Fase 1.5)
    activo          boolean not null default true,
    creado_en       timestamptz not null default now(),
    unique (nombre_base, variante)
);

create table catalogo_materiales_alias (
    id              uuid primary key default gen_random_uuid(),
    material_id     uuid not null references catalogo_materiales(id) on delete cascade,
    alias           text not null,
    unique (material_id, alias)
);

-- =====================================================================
-- TOPE POR MATERIAL Y OBRA (lo que hoy llevan en Excel)
-- =====================================================================
create table obra_material_contratado (
    id                  uuid primary key default gen_random_uuid(),
    obra_id             uuid not null references obras(id) on delete cascade,
    material_id         uuid not null references catalogo_materiales(id),
    cantidad_contratada numeric(12,2) not null check (cantidad_contratada >= 0),
    creado_en           timestamptz not null default now(),
    unique (obra_id, material_id)
);

-- Vista de saldo en vivo: contratado vs. asignado (se completa en 0002 cuando
-- exista asignaciones_material; por ahora referencia solo lo contratado)
create or replace view v_saldo_material_obra as
select
    omc.obra_id,
    omc.material_id,
    cm.nombre_base,
    cm.variante,
    cm.unidad_medida,
    omc.cantidad_contratada,
    0::numeric as cantidad_usada,          -- se reemplaza en migración 0002
    omc.cantidad_contratada as cantidad_disponible
from obra_material_contratado omc
join catalogo_materiales cm on cm.id = omc.material_id;

-- =====================================================================
-- NOTIFICACIONES (para el patrón Realtime + Web Push)
-- =====================================================================
create table notificaciones (
    id              uuid primary key default gen_random_uuid(),
    usuario_id      uuid references usuarios(id),   -- null = broadcast a un rol
    rol_destino     rol_usuario,                      -- alternativa: notificar a todo un rol
    titulo          text not null,
    mensaje         text not null,
    tipo            text not null,                    -- 'solicitud_nueva', 'checklist_pendiente', etc.
    referencia_id   uuid,                              -- id del registro relacionado
    leida           boolean not null default false,
    creado_en       timestamptz not null default now()
);
-- Un webhook de base de datos en esta tabla dispara la Edge Function de Web Push.
-- Ver /supabase/functions/enviar-push (pendiente de Fase 2).

-- =====================================================================
-- RLS — activado desde este mismo commit, sin excepción
-- =====================================================================
alter table usuarios enable row level security;
alter table obras enable row level security;
alter table catalogo_materiales enable row level security;
alter table catalogo_materiales_alias enable row level security;
alter table obra_material_contratado enable row level security;
alter table notificaciones enable row level security;

-- USUARIOS: cada quien ve su propio registro; acceso_total ve todos
create policy usuarios_select on usuarios for select
    using (id = auth.uid() or auth_rol() = 'acceso_total');

-- OBRAS: todos los roles autenticados pueden ver obras (necesario para
-- que Personal elija a qué obra pertenece su solicitud); solo
-- acceso_total y operacion pueden crear/cerrar obras
create policy obras_select on obras for select
    using (auth.uid() is not null);

create policy obras_insert on obras for insert
    with check (auth_rol() in ('acceso_total', 'operacion'));

create policy obras_update on obras for update
    using (auth_rol() in ('acceso_total', 'operacion'));

-- CATALOGO: todos pueden ver (necesario para armar solicitudes); solo
-- 'proyectos' (Manuel) y 'acceso_total' pueden crear/editar materiales
create policy catalogo_select on catalogo_materiales for select
    using (auth.uid() is not null);

create policy catalogo_insert on catalogo_materiales for insert
    with check (auth_rol() in ('proyectos', 'acceso_total'));

create policy catalogo_update on catalogo_materiales for update
    using (auth_rol() in ('proyectos', 'acceso_total'));

create policy catalogo_alias_select on catalogo_materiales_alias for select
    using (auth.uid() is not null);

create policy catalogo_alias_insert on catalogo_materiales_alias for insert
    with check (auth_rol() in ('proyectos', 'acceso_total'));

-- TOPES POR OBRA: todos ven (para saldo en vivo); solo operacion/proyectos/
-- acceso_total pueden definir cuánto se contrató
create policy tope_select on obra_material_contratado for select
    using (auth.uid() is not null);

create policy tope_insert on obra_material_contratado for insert
    with check (auth_rol() in ('operacion', 'proyectos', 'acceso_total'));

create policy tope_update on obra_material_contratado for update
    using (auth_rol() in ('operacion', 'proyectos', 'acceso_total'));

-- NOTIFICACIONES: cada quien ve solo las suyas (directas o de su rol)
create policy notificaciones_select on notificaciones for select
    using (usuario_id = auth.uid() or rol_destino = auth_rol());

create policy notificaciones_update on notificaciones for update
    using (usuario_id = auth.uid());

-- =====================================================================
-- AUDITORÍA — trigger genérico reutilizable para tablas financieras
-- (se aplica a más tablas conforme avancemos de fase)
-- =====================================================================
create table auditoria (
    id              uuid primary key default gen_random_uuid(),
    tabla           text not null,
    registro_id     uuid not null,
    usuario_id      uuid references usuarios(id),
    accion          text not null,          -- INSERT / UPDATE / DELETE
    datos_antes     jsonb,
    datos_despues   jsonb,
    creado_en       timestamptz not null default now()
);
alter table auditoria enable row level security;
create policy auditoria_select on auditoria for select
    using (auth_rol() in ('acceso_total', 'operacion'));

create or replace function fn_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into auditoria (tabla, registro_id, usuario_id, accion, datos_antes, datos_despues)
    values (
        TG_TABLE_NAME,
        coalesce(NEW.id, OLD.id),
        auth.uid(),
        TG_OP,
        case when TG_OP in ('UPDATE','DELETE') then to_jsonb(OLD) else null end,
        case when TG_OP in ('UPDATE','INSERT') then to_jsonb(NEW) else null end
    );
    return coalesce(NEW, OLD);
end;
$$;

create trigger trg_auditoria_obra_material_contratado
    after insert or update or delete on obra_material_contratado
    for each row execute function fn_auditoria();

create trigger trg_auditoria_obras
    after insert or update or delete on obras
    for each row execute function fn_auditoria();

-- NOTA: en la migración 0002 (Fase 4-6) se agrega el trigger de auditoría
-- a facturas_proveedor, asignaciones_material y traspasos_obra — ahí es
-- donde la trazabilidad de dinero importa más.
