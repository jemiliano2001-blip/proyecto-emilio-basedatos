import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buscarMateriales } from '../lib/busqueda-material.ts'

const mat = (id, nombre_base, variante = null, extra = {}) => ({ id, nombre_base, variante, unidad_medida: 'PZA', ...extra })
const textos = m => [m.nombre_base, m.variante ?? '', m.unidad_medida, m.categoria ?? '', m.subcategoria ?? '', ...(m.alias ?? [])]
const ids = (lista, q) => buscarMateriales(lista, q, textos).map(m => m.id)

const lista = [
  mat('conduit', 'Tubo Conduit PAD', '2 pulgadas', { categoria: 'Eléctrico' }),
  mat('pvc', 'Tubo PVC', 'Sanitario', { categoria: 'Obra civil' }),
  mat('cable', 'Cable THW', 'Calibre 12', { categoria: 'Eléctrico', alias: ['alambre'] }),
  mat('varilla', 'Varilla corrugada', '3/8'),
]

test('consulta vacía conserva lista y orden', () => {
  assert.deepEqual(ids(lista, ''), ['conduit', 'pvc', 'cable', 'varilla'])
  assert.deepEqual(ids(lista, '   '), ['conduit', 'pvc', 'cable', 'varilla'])
})

test('ignora acentos y mayúsculas en ambos sentidos', () => {
  assert.deepEqual(ids(lista, 'electrico'), ['conduit', 'cable'])
  assert.deepEqual(ids(lista, 'ELÉCTRICO'), ['conduit', 'cable'])
})

test('el orden de las palabras no importa y todas deben coincidir', () => {
  assert.deepEqual(ids(lista, 'pvc tubo'), ['pvc'])
  assert.deepEqual(ids(lista, 'tubo cable'), [])
})

test('tolera typos y transposiciones en palabras de 4+ letras', () => {
  assert.deepEqual(ids(lista, 'conduti'), ['conduit'])
  assert.deepEqual(ids(lista, 'conudit'), ['conduit'])
  assert.deepEqual(ids(lista, 'varila'), ['varilla'])
  assert.deepEqual(ids(lista, 'corugada'), ['varilla'])
})

test('sin falsos positivos: palabras cortas, números y términos distintos', () => {
  assert.deepEqual(ids(lista, 'pvd'), [])
  assert.deepEqual(ids(lista, 'zzzz'), [])
  assert.deepEqual(ids(lista, 'calibre 13'), [])
  assert.deepEqual(ids(lista, 'calibre 12'), ['cable'])
  assert.deepEqual(ids(lista, 'transformador'), [])
})

test('los alias encuentran el material', () => {
  assert.deepEqual(ids(lista, 'alambre'), ['cable'])
})

test('ordena: exacto antes que prefijo, prefijo antes que difuso', () => {
  const l = [mat('difuso', 'Cabel'), mat('prefijo', 'Cablecito'), mat('exacto', 'Cable')]
  assert.deepEqual(ids(l, 'cable'), ['exacto', 'prefijo', 'difuso'])
})
