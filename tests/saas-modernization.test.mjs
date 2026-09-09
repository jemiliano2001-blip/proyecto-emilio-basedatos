import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  guardarCacheQuery,
  obtenerCacheQuery,
  invalidarCacheQuery,
  limpiarCacheQuery,
  ejecutarConCache,
} from '../lib/cache-query-cliente.ts'

test('caché cliente SWR guarda y recupera datos con TTL', () => {
  limpiarCacheQuery()

  guardarCacheQuery('test:key1', { total: 1500 }, 1000)
  const res = obtenerCacheQuery('test:key1')

  assert.ok(res)
  assert.equal(res.expirado, false)
  assert.equal(res.datos.total, 1500)

  // Clave inexistente devuelve null
  assert.equal(obtenerCacheQuery('test:inexistente'), null)
})

test('caché cliente reporta expirado cuando sobrepasa TTL', async () => {
  limpiarCacheQuery()

  guardarCacheQuery('test:expira-rapido', 'valor', 10) // 10ms
  await new Promise((r) => setTimeout(r, 25))

  const res = obtenerCacheQuery('test:expira-rapido')
  assert.ok(res)
  assert.equal(res.expirado, true)
  assert.equal(res.datos, 'valor')
})

test('invalidarCacheQuery elimina claves exactas y por prefijo', () => {
  limpiarCacheQuery()

  guardarCacheQuery('solicitud:1', { id: '1' })
  guardarCacheQuery('solicitud:2', { id: '2' })
  guardarCacheQuery('orden:1', { id: 'oc-1' })

  invalidarCacheQuery('solicitud:')

  assert.equal(obtenerCacheQuery('solicitud:1'), null)
  assert.equal(obtenerCacheQuery('solicitud:2'), null)
  assert.ok(obtenerCacheQuery('orden:1'))
})

test('ejecutarConCache no invoca fetcher redundante si los datos son frescos', async () => {
  limpiarCacheQuery()

  let llamadas = 0
  const fetcher = async () => {
    llamadas++
    return { data: 'fresca' }
  }

  // Primera llamada: ejecuta fetcher
  const res1 = await ejecutarConCache('test:fetcher', fetcher, 5000)
  assert.equal(res1.data, 'fresca')
  assert.equal(llamadas, 1)

  // Segunda llamada: devuelve caché sin llamar a fetcher
  const res2 = await ejecutarConCache('test:fetcher', fetcher, 5000)
  assert.equal(res2.data, 'fresca')
  assert.equal(llamadas, 1)
})
