import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { databaseFixture } from './db-fixture.mjs'

const U = { proyectos: '10000000-0000-4000-8000-0000000000c1', personal: '10000000-0000-4000-8000-0000000000c2' }
const C1 = '40000000-0000-4000-8000-0000000000c1'
const S1 = '50000000-0000-4000-8000-0000000000c1'
const S2 = '50000000-0000-4000-8000-0000000000c2'

async function fixture({ conTriggerFalla = false } = {}) {
  const db = await databaseFixture()
  // 0015 (no cargada por el fixture) quita estos CHECK antiguos en remoto.
  await db.exec('alter table catalogo_materiales drop constraint if exists catalogo_materiales_categoria_check, drop constraint if exists catalogo_materiales_subcategoria_par_check')
  await db.exec(readFileSync('supabase/migrations/0041_categorias_atomicas.sql', 'utf8'))
  await db.exec(`
    insert into auth.users values ('${U.proyectos}'), ('${U.personal}');
    insert into usuarios(id,nombre,rol) values ('${U.proyectos}','Proyectos','proyectos'), ('${U.personal}','Personal','personal');
    insert into material_categorias(id,nombre) values ('${C1}','Eléctrico'), ('40000000-0000-4000-8000-0000000000c9','Civil');
    insert into material_subcategorias(id,categoria_id,nombre) values ('${S1}','${C1}','Baja Tensión'), ('${S2}','${C1}','Alumbrado');
    insert into catalogo_materiales(nombre_base,unidad_medida,categoria,subcategoria) values
      ('Cable A','M','Eléctrico','Baja Tensión'), ('Cable B','M','Eléctrico','Baja Tensión'),
      ('Lámpara','PZA','Eléctrico','Alumbrado'), ('Varilla','PZA','Civil',null);
  `)
  if (conTriggerFalla) await db.exec(`
    create function falla() returns trigger language plpgsql as $$ begin raise exception 'falla simulada'; end $$;
    create trigger trg_zz_falla before update on catalogo_materiales for each row execute function falla();`)
  return db
}
const como = (db, uid) => db.exec(`select set_config('request.jwt.claim.sub','${uid}',false); set role authenticated;`)
const rpc = (db, fn, ...args) => db.query(`select public.${fn}(${args.map((_, i) => '$' + (i + 1)).join(',')}) n`, args)

test('renombrar categoría cambia categoría y materiales juntos y devuelve cuántos', async t => {
  const db = await fixture(); t.after(() => db.close()); await como(db, U.proyectos)
  assert.equal((await rpc(db, 'renombrar_categoria_material', C1, '  Electromecánico ')).rows[0].n, 3)
  const r = await db.query("select nombre_base, categoria, subcategoria from catalogo_materiales order by nombre_base")
  assert.deepEqual(r.rows.map(x => [x.nombre_base, x.categoria, x.subcategoria]), [
    ['Cable A', 'Electromecánico', 'Baja Tensión'], ['Cable B', 'Electromecánico', 'Baja Tensión'],
    ['Lámpara', 'Electromecánico', 'Alumbrado'], ['Varilla', 'Civil', null]])
})

test('renombrar con nombre repetido falla sin cambiar nada', async t => {
  const db = await fixture(); t.after(() => db.close()); await como(db, U.proyectos)
  await assert.rejects(rpc(db, 'renombrar_categoria_material', C1, 'Civil'), e => e.code === '23505')
  assert.equal((await db.query("select count(*)::int n from catalogo_materiales where categoria='Eléctrico'")).rows[0].n, 3)
})

test('eliminar categoría deja materiales sin categoría y borra subcategorías', async t => {
  const db = await fixture(); t.after(() => db.close()); await como(db, U.proyectos)
  assert.equal((await rpc(db, 'eliminar_categoria_material', C1)).rows[0].n, 3)
  assert.equal((await db.query("select count(*)::int n from catalogo_materiales where categoria is null and subcategoria is null")).rows[0].n, 3)
  assert.equal((await db.query("select count(*)::int n from material_categorias where id=$1", [C1])).rows[0].n, 0)
  assert.equal((await db.query("select count(*)::int n from material_subcategorias")).rows[0].n, 0)
})

test('subcategorías: renombrar y eliminar solo tocan materiales de su categoría', async t => {
  const db = await fixture(); t.after(() => db.close()); await como(db, U.proyectos)
  assert.equal((await rpc(db, 'renombrar_subcategoria_material', S1, 'Media Tensión')).rows[0].n, 2)
  assert.equal((await db.query("select count(*)::int n from catalogo_materiales where subcategoria='Media Tensión'")).rows[0].n, 2)
  assert.equal((await rpc(db, 'eliminar_subcategoria_material', S2)).rows[0].n, 1)
  const l = (await db.query("select categoria, subcategoria from catalogo_materiales where nombre_base='Lámpara'")).rows[0]
  assert.deepEqual([l.categoria, l.subcategoria], ['Eléctrico', null])
  assert.equal((await db.query("select count(*)::int n from material_subcategorias where id=$1", [S2])).rows[0].n, 0)
})

test('sin rol de catálogo se rechaza y un id inexistente avisa', async t => {
  const db = await fixture(); t.after(() => db.close())
  await como(db, U.personal)
  await assert.rejects(rpc(db, 'renombrar_categoria_material', C1, 'X'), /Sin permiso/)
  await assert.rejects(rpc(db, 'eliminar_categoria_material', C1), /Sin permiso/)
  await db.exec('reset role'); await como(db, U.proyectos)
  await assert.rejects(rpc(db, 'eliminar_categoria_material', '40000000-0000-4000-8000-0000000000ff'), /no existe/)
  await assert.rejects(rpc(db, 'renombrar_categoria_material', C1, '   '), /vacío/)
})

test('si falla la actualización de materiales se revierte también la categoría', async t => {
  const db = await fixture({ conTriggerFalla: true }); t.after(() => db.close()); await como(db, U.proyectos)
  await assert.rejects(rpc(db, 'renombrar_categoria_material', C1, 'Nuevo'), /falla simulada/)
  assert.equal((await db.query("select count(*)::int n from material_categorias where nombre='Eléctrico'")).rows[0].n, 1)
  await assert.rejects(rpc(db, 'eliminar_categoria_material', C1), /falla simulada/)
  assert.equal((await db.query("select count(*)::int n from material_categorias where id=$1", [C1])).rows[0].n, 1)
})
