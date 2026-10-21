import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { databaseFixture } from './db-fixture.mjs'

async function fixture() {
  const db = await databaseFixture()
  await db.exec(readFileSync('supabase/migrations/0049_proveedores_datos_fiscales.sql', 'utf8'))
  return db
}
const insertar = (db, campos) => {
  const cols = Object.keys(campos)
  return db.query(
    `insert into proveedores(nombre, ${cols.join(',')}) values ('Proveedor de ejemplo', ${cols.map((_, i) => `$${i + 1}`).join(',')})`,
    Object.values(campos)
  )
}

test('acepta RFC de persona moral y física, correo y valores vacíos', async t => {
  const db = await fixture(); t.after(() => db.close())
  await insertar(db, { rfc: 'ABC010203XY1', correo: 'ventas@ejemplo.com', direccion: 'Calle 1', condiciones_pago: '30 días' })
  await db.query(`update proveedores set rfc = 'ÑAB900101AB2'`)
  await db.query(`update proveedores set rfc = null, correo = null`)
})

test('rechaza RFC y correo con formato inválido', async t => {
  const db = await fixture(); t.after(() => db.close())
  await assert.rejects(insertar(db, { rfc: 'abc010203xy1' }), /proveedores_rfc_formato/)
  await assert.rejects(insertar(db, { rfc: 'AB010203XY1' }), /proveedores_rfc_formato/)
  await assert.rejects(insertar(db, { correo: 'sin-arroba' }), /proveedores_correo_formato/)
})
