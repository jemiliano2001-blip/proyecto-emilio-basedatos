import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const A = 'a'.repeat(64)
const B = 'b'.repeat(64)

async function fixture() {
  const db = new PGlite()
  await db.exec('create role anon; create role authenticated;')
  await db.exec(readFileSync('supabase/migrations/0040_login_rate_limit.sql', 'utf8'))
  return db
}
const bloqueo = async (db, clave, max = 5) =>
  (await db.query('select public.login_segundos_bloqueo($1,$2) s', [clave, max])).rows[0].s
const fallo = (db, clave) => db.query('select public.login_registrar_fallo($1)', [clave])

test('login: bloquea al llegar al máximo de fallos y las claves son independientes', async t => {
  const db = await fixture()
  t.after(() => db.close())
  for (let i = 0; i < 4; i++) await fallo(db, A)
  assert.equal(await bloqueo(db, A), 0)
  await fallo(db, A)
  const s = await bloqueo(db, A)
  assert.ok(s > 0 && s <= 900, `segundos=${s}`)
  assert.equal(await bloqueo(db, B), 0)
  assert.equal(await bloqueo(db, A, 6), 0)
})

test('login: la ventana expira y reinicia el conteo; limpiar quita el bloqueo', async t => {
  const db = await fixture()
  t.after(() => db.close())
  for (let i = 0; i < 5; i++) await fallo(db, A)
  assert.ok(await bloqueo(db, A) > 0)
  await db.exec("update login_intentos set ventana_inicio = now() - interval '16 minutes'")
  assert.equal(await bloqueo(db, A), 0)
  await fallo(db, A)
  assert.equal((await db.query('select fallos from login_intentos')).rows[0].fallos, 1)
  for (let i = 0; i < 4; i++) await fallo(db, A)
  assert.ok(await bloqueo(db, A) > 0)
  await db.query('select public.login_limpiar($1)', [A])
  assert.equal(await bloqueo(db, A), 0)
})

test('login: rechaza claves que no son SHA-256 y purga filas de más de un día', async t => {
  const db = await fixture()
  t.after(() => db.close())
  await assert.rejects(fallo(db, 'correo@ejemplo.com'), /Clave no válida/)
  await fallo(db, A)
  await db.exec("update login_intentos set ventana_inicio = now() - interval '2 days'")
  await fallo(db, B)
  assert.deepEqual((await db.query('select clave_hash from login_intentos')).rows.map(r => r.clave_hash), [B])
})

test('login: anon ejecuta las RPC pero no toca la tabla directamente', async t => {
  const db = await fixture()
  t.after(() => db.close())
  await db.exec('set role anon')
  await fallo(db, A)
  assert.equal(await bloqueo(db, A), 0)
  await assert.rejects(db.query('select * from login_intentos'), /permission denied/i)
  await assert.rejects(db.query('delete from login_intentos'), /permission denied/i)
  await db.exec('reset role; set role authenticated')
  await assert.rejects(db.query('select * from login_intentos'), /permission denied/i)
})
