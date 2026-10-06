import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { databaseFixture } from './db-fixture.mjs'

const U = '10000000-0000-4000-8000-0000000000d1'
const OBRA = '20000000-0000-4000-8000-0000000000d1'
const OTRA = '20000000-0000-4000-8000-0000000000d2'
const MAT = '30000000-0000-4000-8000-0000000000d1'
const SIN = '30000000-0000-4000-8000-0000000000d2'

// Tope 100; 30 en una solicitud pendiente (comprometido). SIN: tope 50 sin compromisos.
async function fixture() {
  const db = await databaseFixture()
  await db.exec(readFileSync('supabase/migrations/0042_piso_tope_material.sql', 'utf8'))
  await db.exec(`
    insert into auth.users values ('${U}');
    insert into usuarios(id,nombre,rol) values ('${U}','Operación','operacion');
    insert into obras(id,nombre,presupuesto_mxn,estado) values ('${OBRA}','Obra A',50000,'activa'), ('${OTRA}','Obra B',50000,'activa');
    insert into catalogo_materiales(id,nombre_base,unidad_medida) values ('${MAT}','Material de ejemplo','PZA'), ('${SIN}','Material libre','PZA');
    insert into obra_material_contratado(obra_id,material_id,cantidad_contratada) values ('${OBRA}','${MAT}',100), ('${OBRA}','${SIN}',50);
    insert into solicitudes_material(id,obra_id,solicitante_id,estado) values ('40000000-0000-4000-8000-0000000000d1','${OBRA}','${U}','recibida');
    insert into solicitud_items(solicitud_id,material_id,cantidad_solicitada,monto_mxn) values ('40000000-0000-4000-8000-0000000000d1','${MAT}',30,0);
    select set_config('request.jwt.claim.sub','${U}',false);
    set role authenticated;`)
  return db
}
const fijar = (db, mat, n, obra = OBRA) =>
  db.query('update obra_material_contratado set cantidad_contratada=$1 where obra_id=$2 and material_id=$3', [n, obra, mat])
const tope = async (db, mat) =>
  Number((await db.query('select cantidad_contratada c from obra_material_contratado where obra_id=$1 and material_id=$2', [OBRA, mat])).rows[0].c)

test('bajar el tope por debajo de lo comprometido falla y no cambia nada', async t => {
  const db = await fixture(); t.after(() => db.close())
  await assert.rejects(fijar(db, MAT, 29), /por debajo de lo ya comprometido.*70/)
  assert.equal(await tope(db, MAT), 100)
})

test('bajar exactamente hasta lo comprometido, subir y bajar sin compromisos pasan', async t => {
  const db = await fixture(); t.after(() => db.close())
  await fijar(db, MAT, 30)
  assert.equal(await tope(db, MAT), 30)
  await fijar(db, MAT, 200)
  assert.equal(await tope(db, MAT), 200)
  await fijar(db, SIN, 0)
  assert.equal(await tope(db, SIN), 0)
})

test('un traspaso de salida también cuenta como comprometido', async t => {
  const db = await fixture(); t.after(() => db.close())
  await db.exec(`reset role; set session_replication_role = replica;
    insert into traspasos_obra(id,obra_origen_id,obra_destino_id,solicitante_id,estado) values ('60000000-0000-4000-8000-0000000000d1','${OBRA}','${OTRA}','${U}','en_transito');
    insert into traspaso_items(traspaso_id,material_id,cantidad) values ('60000000-0000-4000-8000-0000000000d1','${SIN}',20);
    set session_replication_role = origin; set role authenticated;`)
  await assert.rejects(fijar(db, SIN, 19), /por debajo/)
  await fijar(db, SIN, 20)
  assert.equal(await tope(db, SIN), 20)
})

test('insertar y borrar topes no se ven afectados por el piso', async t => {
  const db = await fixture(); t.after(() => db.close())
  await db.query('insert into obra_material_contratado(obra_id,material_id,cantidad_contratada) values ($1,$2,5)', [OTRA, MAT])
  await db.query('delete from obra_material_contratado where obra_id=$1 and material_id=$2', [OTRA, MAT])
  assert.equal((await db.query('select count(*)::int n from obra_material_contratado where obra_id=$1', [OTRA])).rows[0].n, 0)
})
