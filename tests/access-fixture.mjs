import { readFileSync, existsSync } from 'node:fs'
import { databaseFixture } from './db-fixture.mjs'

// Incluye las redefiniciones de recepción que el fixture histórico no cargaba.
// Storage es un esquema SQL aislado; esto no prueba descargas ni PostgREST.
export async function accessFixture({ preparacion = false } = {}) {
  const db = await databaseFixture()
  try {
    await db.exec(`
      create schema storage;
      create table storage.buckets(id text primary key, name text, public boolean);
      create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
      alter table storage.objects enable row level security;
      create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
      create function auth.role() returns text language sql stable as $$select current_user::text$$;
      alter table material_kits add column creado_en timestamptz default now();
      alter table material_kit_items add column creado_en timestamptz default now();
      alter table solicitud_items add column if not exists proveedor_id uuid references proveedores(id);
    `)
    await db.exec(readFileSync('supabase/migrations/0012_precio_base_kits_documentos.sql', 'utf8'))
    await db.exec(readFileSync('supabase/migrations/0018_fotos_obras_recepciones.sql', 'utf8'))
    // Remoto: 0032 estaba instalada antes de la 0019 pendiente.
    await db.exec(readFileSync('supabase/migrations/0032_finanzas_ve_recepciones.sql', 'utf8'))
    await db.exec(readFileSync('supabase/migrations/0019_evidencias_fotograficas_metadatos.sql', 'utf8'))
    await db.exec(readFileSync('supabase/migrations/0023_inventario_campo_instalaciones.sql', 'utf8'))
    await db.exec(readFileSync('supabase/migrations/0031_inventario_campo_con_traspasos.sql', 'utf8'))
    await db.exec(readFileSync('supabase/migrations/0028_recrear_conciliacion_obra_material.sql', 'utf8'))
    await db.exec(readFileSync('supabase/migrations/0027_compras_proveedores_partidas_y_saldos.sql', 'utf8'))
    await db.exec(`grant usage on schema storage to authenticated;
      grant all on obra_documentos, recepcion_fotos, obra_material_instalaciones to authenticated;
      grant select on v_inventario_campo_obra to authenticated;
      grant all on all tables in schema storage to authenticated;
      grant select(id,traspaso_id,material_id,cantidad) on traspaso_items to authenticated;`)
    for (const file of ['0034_acceso_proyectos_y_recepciones.sql', '0034a_preparacion_publicacion.sql', '0036_instalaciones_idempotentes.sql']) {
      const path = 'supabase/migrations/' + file
      if (existsSync(path)) await db.exec(readFileSync(path, 'utf8'))
    }
    if (preparacion) return db
    for (const file of ['0035_lecturas_financieras_y_documentos.sql', '0037_evidencias_recepcion_atomicas.sql', '0038_cotizacion_servicios.sql']) {
      await db.exec(readFileSync('supabase/migrations/' + file, 'utf8'))
    }
    const healthPath = 'supabase/migrations/0039_health_sin_datos.sql'
    if (existsSync(healthPath)) await db.exec(readFileSync(healthPath, 'utf8'))
    return db
  } catch (error) { await db.close(); throw error }
}
