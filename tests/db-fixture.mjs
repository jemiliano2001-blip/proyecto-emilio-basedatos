import { readdirSync, readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

export async function databaseFixture() {
  const db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated, anon;`)
  const names = readdirSync('supabase/migrations')
  for (const prefix of ['0001','0002','0003','0004a','0004_','0004b','0005a','0005_','0005b','0006_','0006a','0007','0008','0009','0010']) {
    const file = names.find(f => f.startsWith(prefix))
    await db.exec(readFileSync('supabase/migrations/' + file, 'utf8').replace('create extension if not exists "pgcrypto";', ''))
  }
  await db.exec(`
    alter table obras add column ciudad text;
    alter table catalogo_materiales add column precio_base numeric default 0;
    create table material_kits (
      id uuid primary key default gen_random_uuid(), nombre text not null,
      material_principal_id uuid references catalogo_materiales(id), configuracion text,
      descripcion text, activo boolean not null default true
    );
    create table material_kit_items (
      id uuid primary key default gen_random_uuid(), kit_id uuid not null references material_kits(id) on delete cascade,
      material_id uuid not null references catalogo_materiales(id), cantidad numeric(12,2) not null check (cantidad > 0),
      unique (kit_id, material_id)
    );
    create table material_categorias (id uuid primary key default gen_random_uuid(), nombre text not null unique, orden int not null default 0);
    create table material_subcategorias (id uuid primary key default gen_random_uuid(), categoria_id uuid not null references material_categorias(id) on delete cascade, nombre text not null, unique(categoria_id, nombre));
    create function fn_notificaciones_solo_leida() returns trigger language plpgsql as $$ begin return new; end $$;
    grant usage on schema public to authenticated, anon;
    grant all on all tables in schema public to authenticated;
    grant usage on all sequences in schema public to authenticated;
  `)
  await db.exec(readFileSync('supabase/migrations/0016_integridad_proyectos_precios.sql','utf8'))
  await db.exec(readFileSync('supabase/migrations/0017_crear_solicitud_atomica.sql','utf8'))
  await db.exec(readFileSync('supabase/migrations/0020_reserva_provisional_y_borrado_materiales.sql','utf8'))
  await db.exec(readFileSync('supabase/migrations/0025_operaciones_atomicas_catalogo.sql','utf8'))
  return db
}
