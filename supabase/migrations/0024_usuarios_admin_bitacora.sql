-- =====================================================================
-- MIGRACIÓN 0024 — Administración de usuarios + bitácora usable
-- - Columna email en public.usuarios (espejo de auth.users)
-- - RLS INSERT/UPDATE solo para acceso_total
-- - Trigger de auditoría en usuarios
-- - Índices para listar la bitácora
-- =====================================================================
-- NO aplicar sin revisión manual (regla del proyecto).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) email en usuarios
-- ---------------------------------------------------------------------
alter table public.usuarios
  add column if not exists email text;

-- Backfill desde auth.users cuando exista el correo
update public.usuarios u
set email = lower(au.email)
from auth.users au
where au.id = u.id
  and u.email is null
  and au.email is not null
  and length(trim(au.email)) > 0;

-- Filas huérfanas sin correo en Auth: placeholder único para poder
-- endurecer NOT NULL / UNIQUE sin tumbar datos viejos.
update public.usuarios
set email = lower(id::text || '@sin-email.local')
where email is null or length(trim(email)) = 0;

alter table public.usuarios
  alter column email set not null;

-- Normalizar a minúsculas por si quedó algo raro
update public.usuarios set email = lower(trim(email));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'usuarios_email_key'
      and conrelid = 'public.usuarios'::regclass
  ) then
    alter table public.usuarios
      add constraint usuarios_email_key unique (email);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2) RLS: acceso_total puede insertar y actualizar perfiles
--    (crear cuenta Auth sigue siendo Admin API / service_role en servidor)
-- ---------------------------------------------------------------------
drop policy if exists usuarios_insert on public.usuarios;
create policy usuarios_insert on public.usuarios
  for insert
  with check (auth_rol() = 'acceso_total');

drop policy if exists usuarios_update on public.usuarios;
create policy usuarios_update on public.usuarios
  for update
  using (auth_rol() = 'acceso_total')
  with check (auth_rol() = 'acceso_total');

-- ---------------------------------------------------------------------
-- 3) Auditoría de cambios en usuarios
-- ---------------------------------------------------------------------
drop trigger if exists trg_auditoria_usuarios on public.usuarios;
create trigger trg_auditoria_usuarios
  after insert or update or delete on public.usuarios
  for each row execute function fn_auditoria();

-- No dejar el sistema sin al menos un acceso_total activo
create or replace function fn_usuarios_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  restantes integer;
begin
  if (
    old.rol = 'acceso_total'::rol_usuario
    and old.activo = true
    and (
      new.rol is distinct from 'acceso_total'::rol_usuario
      or new.activo = false
    )
  ) then
    select count(*)::integer into restantes
    from public.usuarios
    where rol = 'acceso_total'::rol_usuario
      and activo = true
      and id is distinct from old.id;

    if restantes < 1 then
      raise exception
        'Debe quedar al menos un usuario con acceso total activo'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_usuarios_before_update on public.usuarios;
create trigger trg_usuarios_before_update
  before update on public.usuarios
  for each row execute function fn_usuarios_before_update();

-- ---------------------------------------------------------------------
-- 4) Índices para /bitacora
-- ---------------------------------------------------------------------
create index if not exists idx_auditoria_creado_en_desc
  on public.auditoria (creado_en desc);

create index if not exists idx_auditoria_tabla_creado_en
  on public.auditoria (tabla, creado_en desc);

create index if not exists idx_auditoria_usuario_creado_en
  on public.auditoria (usuario_id, creado_en desc);
