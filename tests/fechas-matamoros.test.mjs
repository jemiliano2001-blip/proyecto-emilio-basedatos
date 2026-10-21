import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  ZONA_OBRA,
  finDiaZonaExclusivo,
  formatearFechaBitacora,
  formatearFechaLista,
  inicioDiaZona,
} from '../lib/fechas.ts'

const INSTANTE = '2026-10-21T00:28:00Z'
const ESPERADO = '20/10/2026 7:28 p.m.'

test('la Bitácora y la lista muestran 20/10/2026 7:28 p.m. en Matamoros', () => {
  assert.equal(ZONA_OBRA, 'America/Matamoros')
  assert.equal(formatearFechaBitacora(INSTANTE), ESPERADO)
  assert.equal(formatearFechaLista(INSTANTE), ESPERADO)
  assert.equal(formatearFechaBitacora(new Date(INSTANTE)), ESPERADO)
  assert.equal(formatearFechaLista(new Date(INSTANTE)), ESPERADO)

  const bitacora = readFileSync('app/bitacora/page.tsx', 'utf8')
  const detalle = readFileSync('app/bitacora/[id]/page.tsx', 'utf8')
  const lista = readFileSync('components/SolicitudesListClient.tsx', 'utf8')
  const ordenes = readFileSync('app/ordenes/page.tsx', 'utf8')
  const recepciones = readFileSync('app/recepciones/page.tsx', 'utf8')
  const avisos = readFileSync('app/notificaciones/page.tsx', 'utf8')
  assert.match(bitacora, /formatearFechaBitacora/)
  assert.match(detalle, /formatearFechaBitacora/)
  assert.match(lista, /formatearFechaLista/)
  assert.match(ordenes, /formatearFechaLista/)
  assert.match(recepciones, /formatearFechaLista/)
  assert.match(avisos, /formatearFechaLista/)
  assert.equal(bitacora.includes('T00:00:00'), false)
  assert.equal(ordenes.includes('T00:00:00'), false)
})

test('el día 20 de octubre en Matamoros incluye las 7:28 p.m. y no el mediodía UTC', () => {
  const inicio = inicioDiaZona('2026-10-20')
  const fin = finDiaZonaExclusivo('2026-10-20')
  assert.equal(inicio, '2026-10-20T05:00:00.000Z')
  assert.equal(fin, '2026-10-21T05:00:00.000Z')
  assert.equal(INSTANTE >= inicio && INSTANTE < fin, true)
  assert.equal('2026-10-21T12:28:00Z' >= inicio && '2026-10-21T12:28:00Z' < fin, false)
})
