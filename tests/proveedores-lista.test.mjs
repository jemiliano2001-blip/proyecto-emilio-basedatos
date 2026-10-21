import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  enlaceLlamar,
  enlaceWhatsApp,
  filtrarProveedores,
  resumirHistorial,
} from '../lib/proveedores-lista.ts'

const p = (nombre, extra = {}) => ({
  id: nombre,
  nombre,
  contacto: null,
  telefono: null,
  activo: true,
  creado_en: '2026-01-01T00:00:00Z',
  ...extra,
})

test('enlaces de llamada y WhatsApp salen del teléfono o no existen', () => {
  assert.equal(enlaceLlamar('81 1234 5678'), 'tel:+528112345678')
  assert.equal(enlaceWhatsApp('(81) 1234-5678'), 'https://wa.me/528112345678')
  assert.equal(enlaceLlamar(null), null)
  assert.equal(enlaceWhatsApp('  '), null)
  assert.equal(enlaceWhatsApp('123'), null)
  assert.equal(enlaceLlamar('abc'), null)
})

test('filtrarProveedores busca por nombre, contacto o teléfono y por estatus', () => {
  const lista = [
    p('Electro Norte', { contacto: 'Marcos Ruiz', telefono: '81 1234 5678' }),
    p('Tubos del Bajío', { activo: false }),
    p('Cables Ñandú'),
  ]
  assert.equal(filtrarProveedores(lista, '', 'todos').length, 3)
  assert.deepEqual(filtrarProveedores(lista, '', 'activos').map((x) => x.nombre), [
    'Electro Norte',
    'Cables Ñandú',
  ])
  assert.deepEqual(filtrarProveedores(lista, 'marcos', 'todos').map((x) => x.nombre), ['Electro Norte'])
  assert.deepEqual(filtrarProveedores(lista, '1234', 'todos').map((x) => x.nombre), ['Electro Norte'])
  assert.deepEqual(filtrarProveedores(lista, 'BAJIO', 'todos').map((x) => x.nombre), ['Tubos del Bajío'])
  assert.deepEqual(filtrarProveedores(lista, 'ñandu', 'todos').map((x) => x.nombre), ['Cables Ñandú'])
  assert.equal(filtrarProveedores(lista, 'zzz', 'todos').length, 0)
})

test('resumirHistorial no cuenta canceladas en total ni en última compra', () => {
  const ordenes = [
    { estado: 'emitida', total: '100.50', creado_en: '2026-03-01T10:00:00Z' },
    { estado: 'recibida', total: 200, creado_en: '2026-05-01T10:00:00Z' },
    { estado: 'cancelada', total: 999, creado_en: '2026-06-01T10:00:00Z' },
  ]
  assert.deepEqual(resumirHistorial(ordenes), {
    cantidad: 2,
    total: 300.5,
    ultima: '2026-05-01T10:00:00Z',
  })
  assert.deepEqual(resumirHistorial([]), { cantidad: 0, total: 0, ultima: null })
})
