import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { accessFixture } from './access-fixture.mjs'

const puede = (db, rol, firma) =>
  db.query('select has_function_privilege($1, $2::regprocedure, $3) p', [rol, firma, 'execute']).then(r => r.rows[0].p)

async function fixture() {
  const db = await accessFixture()
  // 0024 no está en el fixture; basta una función de trigger con la misma firma.
  await db.exec(`create function public.fn_usuarios_before_update() returns trigger language plpgsql security definer as $$ begin return new; end $$;`)
  return db
}

test('0044: anon y público pierden EXECUTE; authenticated conserva el RPC de partidas', async t => {
  const db = await fixture(); t.after(() => db.close())
  const eliminar = 'public.eliminar_item_solicitud(uuid,uuid)'
  const trigger = 'public.fn_usuarios_before_update()'
  assert.equal(await puede(db, 'anon', eliminar), true, 'precondición: el hueco existe antes de 0044')
  assert.equal(await puede(db, 'anon', trigger), true, 'precondición: el hueco existe antes de 0044')

  await db.exec(readFileSync('supabase/migrations/0044_revocar_execute_anon.sql', 'utf8'))

  assert.equal(await puede(db, 'anon', eliminar), false)
  assert.equal(await puede(db, 'authenticated', eliminar), true)
  assert.equal(await puede(db, 'anon', trigger), false)
  assert.equal(await puede(db, 'authenticated', trigger), false)
})
