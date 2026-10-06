import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { accessFixture } from './access-fixture.mjs'

const U = '10000000-0000-4000-8000-0000000000e1'
const OBRA = '20000000-0000-4000-8000-0000000000e1'
const OTRA = '20000000-0000-4000-8000-0000000000e2'
const VACIA = '20000000-0000-4000-8000-0000000000e9'
const M = n => `30000000-0000-4000-8000-0000000000e${n}`
const S = n => `40000000-0000-4000-8000-0000000000e${n}`
// M1 libre · M2 solicitud pendiente · M3 solicitud rechazada · M4 traspaso · M5 instalación · M6 reserva aplicada
async function fixture() {
  const db = await accessFixture()
  await db.exec(readFileSync('supabase/migrations/0043_bloqueo_borrar_tope.sql', 'utf8'))
  await db.exec(`
    insert into auth.users values ('${U}');
    insert into usuarios(id,nombre,rol) values ('${U}','Operación','operacion');
    insert into obras(id,nombre,presupuesto_mxn,estado) values ('${OBRA}','Obra A',50000,'activa'), ('${OTRA}','Obra B',50000,'activa');
    insert into catalogo_materiales(id,nombre_base,unidad_medida) values
      ('${M(1)}','Libre','PZA'),('${M(2)}','Con solicitud','PZA'),('${M(3)}','Solicitud rechazada','PZA'),
      ('${M(4)}','Con traspaso','PZA'),('${M(5)}','Con instalación','PZA'),('${M(6)}','Con reserva','PZA');
    insert into obra_material_contratado(obra_id,material_id,cantidad_contratada)
      select '${OBRA}', id, 100 from catalogo_materiales;
    insert into solicitudes_material(id,obra_id,solicitante_id,estado) values
      ('${S(1)}','${OBRA}','${U}','recibida'),
      ('${S(2)}','${OBRA}','${U}','rechazada'),
      ('${S(3)}','${OBRA}','${U}','finalizada');
    insert into solicitud_items(solicitud_id,material_id,cantidad_solicitada,monto_mxn) values
      ('${S(1)}','${M(2)}',5,0),
      ('${S(2)}','${M(3)}',5,0),
      ('${S(3)}','${M(6)}',5,0);
    insert into solicitud_reservas_cantidad(solicitud_id,obra_id,material_id,cantidad,estado)
      values ('${S(3)}','${OBRA}','${M(6)}',5,'aplicada');
    set session_replication_role = replica;
    insert into traspasos_obra(id,obra_origen_id,obra_destino_id,solicitante_id,estado) values ('60000000-0000-4000-8000-0000000000e1','${OBRA}','${OTRA}','${U}','en_transito');
    insert into traspaso_items(traspaso_id,material_id,cantidad) values ('60000000-0000-4000-8000-0000000000e1','${M(4)}',5);
    set session_replication_role = origin;
    insert into obra_material_instalaciones(obra_id,material_id,cantidad,reportado_por) values ('${OBRA}','${M(5)}',1,'${U}');
    select set_config('request.jwt.claim.sub','${U}',false);
    set role authenticated;`)
  return db
}
const borrar = (db, n) => db.query('delete from obra_material_contratado where obra_id=$1 and material_id=$2', [OBRA, M(n)])
const existe = async (db, n) => (await db.query('select count(*)::int c from obra_material_contratado where obra_id=$1 and material_id=$2', [OBRA, M(n)])).rows[0].c === 1

test('un material sin movimientos se puede borrar; una solicitud rechazada no cuenta', async t => {
  const db = await fixture(); t.after(() => db.close())
  await borrar(db, 1); assert.equal(await existe(db, 1), false)
  await borrar(db, 3); assert.equal(await existe(db, 3), false)
})

test('se bloquea con solicitud pendiente, traspaso, instalación o reserva aplicada', async t => {
  const db = await fixture(); t.after(() => db.close())
  for (const n of [2, 4, 5, 6]) {
    await assert.rejects(borrar(db, n), /No se puede quitar.*ya tiene movimientos/, `material ${n}`)
    assert.equal(await existe(db, n), true)
  }
  await assert.rejects(borrar(db, 2), /Con solicitud/)
})

test('un traspaso cancelado no bloquea', async t => {
  const db = await fixture(); t.after(() => db.close())
  await db.exec(`reset role; set session_replication_role = replica;
    update traspasos_obra set estado='cancelado'; set session_replication_role = origin; set role authenticated;`)
  await borrar(db, 4); assert.equal(await existe(db, 4), false)
})

test('borrar todos es atómico: si uno tiene movimientos no se borra ninguno', async t => {
  const db = await fixture(); t.after(() => db.close())
  await assert.rejects(db.query('delete from obra_material_contratado where obra_id=$1', [OBRA]), /No se puede quitar/)
  assert.equal((await db.query('select count(*)::int c from obra_material_contratado where obra_id=$1', [OBRA])).rows[0].c, 6)
})

test('el borrado en cascada de un proyecto sin movimientos no se bloquea', async t => {
  const db = await fixture(); t.after(() => db.close())
  await db.exec(`reset role; insert into obras(id,nombre,presupuesto_mxn,estado) values ('${VACIA}','Obra vacía',1,'activa');
    insert into obra_material_contratado(obra_id,material_id,cantidad_contratada) values ('${VACIA}','${M(1)}',3);
    delete from obras where id='${VACIA}';`)
  assert.equal((await db.query('select count(*)::int c from obra_material_contratado where obra_id=$1', [VACIA])).rows[0].c, 0)
})
