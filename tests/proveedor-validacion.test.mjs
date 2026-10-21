import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateProveedorInput } from '../lib/validations/proveedor.ts'

const base = { nombre: 'Proveedor de ejemplo' }

test('normaliza RFC a mayúsculas sin espacios y correo a minúsculas', () => {
  const r = validateProveedorInput({ ...base, rfc: ' abc 010203 xy1 ', correo: ' Ventas@Ejemplo.COM ' })
  assert.ok(r.ok)
  assert.equal(r.data.rfc, 'ABC010203XY1')
  assert.equal(r.data.correo, 'ventas@ejemplo.com')
})

test('los campos nuevos vacíos quedan en null', () => {
  const r = validateProveedorInput({ ...base, rfc: '  ', correo: '', direccion: null })
  assert.ok(r.ok)
  assert.deepEqual(
    [r.data.rfc, r.data.correo, r.data.direccion, r.data.condiciones_pago],
    [null, null, null, null]
  )
})

test('rechaza RFC y correo inválidos con mensaje claro', () => {
  const rfc = validateProveedorInput({ ...base, rfc: 'ABC123' })
  assert.ok(!rfc.ok)
  assert.match(rfc.error, /RFC/)
  const correo = validateProveedorInput({ ...base, correo: 'sin-arroba' })
  assert.ok(!correo.ok)
  assert.match(correo.error, /correo/i)
})

test('rechaza dirección y condiciones de pago demasiado largas', () => {
  assert.ok(!validateProveedorInput({ ...base, direccion: 'x'.repeat(501) }).ok)
  assert.ok(!validateProveedorInput({ ...base, condiciones_pago: 'x'.repeat(201) }).ok)
})
