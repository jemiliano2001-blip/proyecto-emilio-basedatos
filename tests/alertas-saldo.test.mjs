import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { accessFixture } from './access-fixture.mjs'

// UUID determinista por prueba: el primer dígito identifica el tipo de entidad.
let contador = 0
const uuid = (p) => `${p}0000000-0000-4000-8000-${String(++contador).padStart(12, '0')}`

async function fixture() {
  const db = await accessFixture()
  await db.exec(readFileSync('supabase/migrations/0045_alertas_saldo.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/0047_alertas_saldo_agrupadas.sql', 'utf8'))
  db.admin = uuid('1')
  await db.exec(`insert into auth.users values ('${db.admin}');
    insert into usuarios(id,nombre,rol) values ('${db.admin}','Admin alertas','acceso_total');`)
  return db
}
const nuevaObra = async (db, nombre = 'Proyecto de ejemplo', presupuesto = 0) => {
  const id = uuid('2')
  await db.query("insert into obras(id,nombre,presupuesto_mxn,estado) values ($1,$2,$3,'activa')", [id, nombre, presupuesto])
  return id
}
const nuevoMaterial = async (db, nombre = 'Material de ejemplo', unidad = 'PZA') => {
  const id = uuid('3')
  await db.query('insert into catalogo_materiales(id,nombre_base,unidad_medida) values ($1,$2,$3)', [id, nombre, unidad])
  return id
}
const conTope = (db, obra, mat, cantidad) =>
  db.query('insert into obra_material_contratado(obra_id,material_id,cantidad_contratada) values ($1,$2,$3)', [obra, mat, cantidad])
// Una solicitud "recibida" descuenta de inmediato (reserva provisional): cuenta como "en proceso" en la vista.
async function comprometer(db, obra, mat, n) {
  const sol = uuid('4')
  const item = uuid('5')
  await db.query("insert into solicitudes_material(id,obra_id,solicitante_id,estado) values ($1,$2,$3,'recibida')", [sol, obra, db.admin])
  await db.query('insert into solicitud_items(id,solicitud_id,material_id,cantidad_solicitada,monto_mxn) values ($1,$2,$3,$4,0)', [item, sol, mat, n])
  return item
}
const ajustar = (db, item, n) => db.query('update solicitud_items set cantidad_solicitada=$1 where id=$2', [n, item])
const revisar = async (db) => (await db.query('select public.revisar_alertas_saldo() n')).rows[0].n
const avisos = async (db, tipo = 'alerta_saldo_material') =>
  (await db.query('select rol_destino::text rol, titulo, mensaje, referencia_id from notificaciones where tipo=$1 order by creado_en, rol_destino::text', [tipo])).rows
const cuenta = async (db, sql, params = []) => (await db.query(sql, params)).rows[0].n

// Escenario base: proyecto activo, un material con tope 100 y una solicitud pendiente ajustable.
async function escenario(db, { tope = 100, consumo = 0, nombreObra, nombreMat } = {}) {
  const obra = await nuevaObra(db, nombreObra)
  const mat = await nuevoMaterial(db, nombreMat)
  await conTope(db, obra, mat, tope)
  const item = await comprometer(db, obra, mat, consumo)
  return { obra, mat, item }
}

test('material: 79 % no avisa, 80 % avisa nivel 80, 100 % avisa nivel 100', async (t) => {
  const db = await fixture(); t.after(() => db.close())
  const { item } = await escenario(db, { consumo: 79 })
  assert.equal(await revisar(db), 0)
  await ajustar(db, item, 80)
  assert.equal(await revisar(db), 3)
  assert.ok((await avisos(db)).every((a) => a.titulo === 'Material al 80 % del tope'))
  await ajustar(db, item, 100)
  assert.equal(await revisar(db), 3)
  const todos = await avisos(db)
  assert.equal(todos.length, 6)
  assert.equal(todos.filter((a) => a.titulo === 'Material en su tope').length, 3)
  assert.ok(todos.every((a) => !a.mensaje.includes('$')), 'sin importes en avisos de material')
})

test('es idempotente: repetir la revisión no duplica avisos ni alertas activas', async (t) => {
  const db = await fixture(); t.after(() => db.close())
  await escenario(db, { consumo: 85 })
  assert.equal(await revisar(db), 3)
  const antes = [await cuenta(db, 'select count(*)::int n from notificaciones'), await cuenta(db, 'select count(*)::int n from alertas_saldo where resuelta_en is null')]
  assert.equal(await revisar(db), 0)
  assert.deepEqual([await cuenta(db, 'select count(*)::int n from notificaciones'), await cuenta(db, 'select count(*)::int n from alertas_saldo where resuelta_en is null')], antes)
})

test('se re-arma con histéresis de 5 puntos', async (t) => {
  const db = await fixture(); t.after(() => db.close())
  const { item } = await escenario(db, { consumo: 80 })
  assert.equal(await revisar(db), 3)
  await ajustar(db, item, 76)
  assert.equal(await revisar(db), 0)
  assert.equal(await cuenta(db, 'select count(*)::int n from alertas_saldo where resuelta_en is null'), 1, 'sigue activa a 76 %')
  await ajustar(db, item, 74)
  assert.equal(await revisar(db), 0)
  assert.equal(await cuenta(db, 'select count(*)::int n from alertas_saldo where resuelta_en is not null'), 1, 'resuelta bajo 75 %')
  await ajustar(db, item, 80)
  assert.equal(await revisar(db), 3)
  assert.equal((await avisos(db)).length, 6)
})

test('primer cruce directo a 100 % emite un solo aviso por rol y deja la fila de 80 en silencio', async (t) => {
  const db = await fixture(); t.after(() => db.close())
  await escenario(db, { consumo: 105 })
  assert.equal(await revisar(db), 3)
  const a = await avisos(db)
  assert.ok(a.every((x) => x.titulo === 'Material en su tope'))
  assert.deepEqual((await db.query('select nivel from alertas_saldo order by nivel')).rows.map((r) => r.nivel), [80, 100])
})

test('destinatarios de material: compras, operacion y acceso_total; nunca finanzas ni personal', async (t) => {
  const db = await fixture(); t.after(() => db.close())
  await escenario(db, { consumo: 90 })
  await revisar(db)
  assert.deepEqual((await avisos(db)).map((a) => a.rol).sort(), ['acceso_total', 'compras', 'operacion'])
})

test('caracteres especiales en nombres no rompen el mensaje', async (t) => {
  const db = await fixture(); t.after(() => db.close())
  const { obra } = await escenario(db, { consumo: 90, nombreObra: '100% "Norte" %s', nombreMat: "Cable 5% O'Hara %s" })
  assert.equal(await revisar(db), 3)
  const [a] = await avisos(db)
  assert.ok(a.mensaje.includes('100% "Norte" %s') && a.mensaje.includes("Cable 5% O'Hara %s"))
  assert.equal(a.referencia_id, obra)
})

test('capacidad <= 0 con consumo cuenta como 100 % (sin dividir entre cero)', async (t) => {
  const db = await fixture(); t.after(() => db.close())
  const { obra, mat } = await escenario(db, { tope: 10, consumo: 1 })
  const otra = await nuevaObra(db, 'Proyecto destino')
  // El traspaso de salida completado vacía el tope (los triggers de traspasos no aplican a la siembra).
  const tr = uuid('6')
  await db.exec(`set session_replication_role = replica;
    insert into traspasos_obra(id,obra_origen_id,obra_destino_id,solicitante_id,estado) values ('${tr}','${obra}','${otra}','${db.admin}','completado');
    insert into traspaso_items(traspaso_id,material_id,cantidad) values ('${tr}','${mat}',10);
    set session_replication_role = origin;`)
  assert.equal(await revisar(db), 3)
  assert.ok((await avisos(db)).every((a) => a.titulo === 'Material en su tope'))
})

test('un consumo enorme sobre un tope minúsculo no desborda uso_pct', async (t) => {
  const db = await fixture(); t.after(() => db.close())
  await escenario(db, { tope: 1, consumo: 5000 })
  assert.equal(await revisar(db), 3)
  assert.equal(Number(await cuenta(db, 'select max(uso_pct)::float n from alertas_saldo')), 999)
})

test('dos proyectos activos son independientes', async (t) => {
  const db = await fixture(); t.after(() => db.close())
  const mat = await nuevoMaterial(db)
  const A = await nuevaObra(db, 'Proyecto A'); const B = await nuevaObra(db, 'Proyecto B')
  await conTope(db, A, mat, 100); await conTope(db, B, mat, 100)
  await comprometer(db, A, mat, 85)
  const itemB = await comprometer(db, B, mat, 10)
  assert.equal(await revisar(db), 3)
  assert.ok((await avisos(db)).every((a) => a.referencia_id === A))
  await ajustar(db, itemB, 100)
  assert.equal(await revisar(db), 3)
  const nuevos = (await avisos(db)).filter((a) => a.referencia_id === B)
  assert.equal(nuevos.length, 3)
  assert.equal((await avisos(db)).filter((a) => a.referencia_id === A).length, 3, 'A no se duplica')
})

test('proyecto cerrado resuelve la alerta y reabrirlo la vuelve a emitir', async (t) => {
  const db = await fixture(); t.after(() => db.close())
  const { obra } = await escenario(db, { consumo: 85 })
  assert.equal(await revisar(db), 3)
  await db.exec(`set session_replication_role = replica; update obras set estado='cerrada' where id='${obra}'; set session_replication_role = origin;`)
  assert.equal(await revisar(db), 0)
  assert.equal(await cuenta(db, 'select count(*)::int n from alertas_saldo where resuelta_en is null'), 0)
  await db.exec(`set session_replication_role = replica; update obras set estado='activa' where id='${obra}'; set session_replication_role = origin;`)
  assert.equal(await revisar(db), 3)
  assert.equal((await avisos(db)).length, 6)
})

test('sin usuario acceso_total devuelve 0 sin error', async (t) => {
  const db = await fixture(); t.after(() => db.close())
  await escenario(db, { consumo: 90 })
  await db.query("update usuarios set activo=false where rol='acceso_total'")
  assert.equal(await revisar(db), 0)
  assert.equal((await avisos(db)).length, 0)
})

test('funciona sin sesión, como el cron (la vista de saldos devuelve 0 filas sin usuario)', async (t) => {
  const db = await fixture(); t.after(() => db.close())
  await escenario(db, { consumo: 90 })
  await db.exec("select set_config('request.jwt.claim.sub','',false)")
  assert.equal(await cuenta(db, 'select count(*)::int n from v_saldo_material_obra'), 0, 'control: sin usuario la vista está vacía')
  assert.equal(await revisar(db), 3)
})

test('permisos: anon y authenticated no ejecutan la revisión ni tocan la tabla', async (t) => {
  const db = await fixture(); t.after(() => db.close())
  for (const rol of ['anon', 'authenticated']) {
    await db.exec(`reset role; set role ${rol}`)
    await assert.rejects(db.query('select public.revisar_alertas_saldo()'), /permission denied/i, `${rol} ejecuta`)
    await assert.rejects(db.query('select * from alertas_saldo'), /permission denied/i, `${rol} lee`)
    await assert.rejects(db.query("insert into alertas_saldo(obra_id,tipo,nivel,uso_pct) values ('" + uuid('2') + "','presupuesto',80,80)"), /permission denied/i, `${rol} escribe`)
  }
})

// ---- Presupuesto en dinero ----
const mover = (db, obra, tipo, monto) =>
  db.query('insert into obra_presupuesto_movimientos(obra_id,tipo,monto_mxn) values ($1,$2,$3)', [obra, tipo, monto])
const PRES = 'alerta_saldo_presupuesto'

test('presupuesto: 80 % y 100 % avisan a finanzas, operacion y acceso_total', async (t) => {
  const db = await fixture(); t.after(() => db.close())
  const obra = await nuevaObra(db, 'Proyecto con dinero', 10000)
  await mover(db, obra, 'reserva', 8000)
  assert.equal(await revisar(db), 3)
  const a80 = await avisos(db, PRES)
  assert.ok(a80.every((a) => a.titulo === 'Presupuesto al 80 %' && a.referencia_id === obra))
  assert.deepEqual(a80.map((a) => a.rol).sort(), ['acceso_total', 'finanzas', 'operacion'])
  await mover(db, obra, 'gasto', 2000)
  assert.equal(await revisar(db), 3)
  const todos = await avisos(db, PRES)
  assert.equal(todos.filter((a) => a.titulo === 'Presupuesto agotado').length, 3)
  assert.equal((await avisos(db)).length, 0, 'sin material no hay avisos de material')
})

test('el aviso de presupuesto trae los importes en MXN', async (t) => {
  const db = await fixture(); t.after(() => db.close())
  const obra = await nuevaObra(db, 'Proyecto con dinero', 10000)
  await mover(db, obra, 'reserva', 8000)
  await revisar(db)
  const [a] = await avisos(db, PRES)
  assert.ok(a.mensaje.includes('$8,000.00') && a.mensaje.includes('$10,000.00'), a.mensaje)
  assert.ok(a.mensaje.includes('80 %'))
})

test('presupuesto 0: con gasto cuenta como 100 %, sin gasto no emite', async (t) => {
  const db = await fixture(); t.after(() => db.close())
  const obra = await nuevaObra(db, 'Proyecto sin presupuesto', 0)
  assert.equal(await revisar(db), 0)
  await mover(db, obra, 'reserva', 50)
  assert.equal(await revisar(db), 3)
  assert.ok((await avisos(db, PRES)).every((a) => a.titulo === 'Presupuesto agotado'))
})

test('material y dinero son independientes en un mismo proyecto', async (t) => {
  const db = await fixture(); t.after(() => db.close())
  const obra = await nuevaObra(db, 'Proyecto mixto', 10000)
  const mat = await nuevoMaterial(db)
  await conTope(db, obra, mat, 100)
  await comprometer(db, obra, mat, 85)
  await mover(db, obra, 'reserva', 10000)
  assert.equal(await revisar(db), 6)
  assert.equal((await avisos(db)).length, 3)
  assert.equal((await avisos(db, PRES)).length, 3)
  assert.equal(await revisar(db), 0)
})

// ---- Agrupación por proyecto (0047) ----
async function obraConMateriales(db, nombreObra, nombres, { tope = 10, consumo = 10 } = {}) {
  const obra = await nuevaObra(db, nombreObra)
  for (const n of nombres) {
    const m = await nuevoMaterial(db, n)
    await conTope(db, obra, m, tope)
    await comprometer(db, obra, m, consumo)
  }
  return obra
}

test('agrupa por proyecto: 4 materiales al 100 % generan un solo aviso por rol', async (t) => {
  const db = await fixture(); t.after(() => db.close())
  const nombres = ['Poste', 'Brazo', 'Registro A', 'Registro B']
  const obra = await obraConMateriales(db, 'Proyecto grande', nombres)
  assert.equal(await revisar(db), 3)
  const a = await avisos(db)
  assert.equal(a.length, 3)
  assert.ok(a.every((x) => x.titulo === '4 materiales en su tope' && x.referencia_id === obra && nombres.every((n) => x.mensaje.includes(n))))
  assert.equal(await cuenta(db, 'select count(*)::int n from alertas_saldo where resuelta_en is null'), 8, 'el estado sigue siendo por material')
  assert.equal(await revisar(db), 0, 'idempotente')
})

test('la lista de materiales se corta en 5 con "y N más"', async (t) => {
  const db = await fixture(); t.after(() => db.close())
  await obraConMateriales(db, 'Proyecto enorme', ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'])
  assert.equal(await revisar(db), 3)
  const [a] = await avisos(db)
  assert.equal(a.titulo, '7 materiales en su tope')
  assert.ok(a.mensaje.includes('M1') && a.mensaje.includes('M5') && !a.mensaje.includes('M6') && a.mensaje.includes('y 2 más'), a.mensaje)
})

test('niveles distintos de un mismo proyecto se agrupan por separado', async (t) => {
  const db = await fixture(); t.after(() => db.close())
  const obra = await obraConMateriales(db, 'Proyecto mixto de niveles', ['Cable A', 'Cable B'], { tope: 100, consumo: 85 })
  const m = await nuevoMaterial(db, 'Poste lleno')
  await conTope(db, obra, m, 10); await comprometer(db, obra, m, 10)
  assert.equal(await revisar(db), 6)
  const a = await avisos(db)
  assert.equal(a.filter((x) => x.titulo === '2 materiales al 80 % del tope').length, 3)
  assert.equal(a.filter((x) => x.titulo === 'Material en su tope').length, 3, 'un solo material usa el texto individual')
})

test('borde del 100 %: 99,999 % avisa nivel 80 y muestra 99 %', async (t) => {
  const db = await fixture(); t.after(() => db.close())
  await escenario(db, { tope: 100000, consumo: 99999 })
  assert.equal(await revisar(db), 3)
  const [a] = await avisos(db)
  assert.equal(a.titulo, 'Material al 80 % del tope')
  assert.ok(a.mensaje.includes('lleva el 99 %'), a.mensaje)
})
