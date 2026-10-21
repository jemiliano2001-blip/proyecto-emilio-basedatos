import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  SIN_DATO,
  ZONA_OBRA,
  agruparPorDia,
  encabezadoDia,
  fechaDocumento,
  finDiaZonaExclusivo,
  formatearFechaBitacora,
  formatearFechaLista,
  hora12,
  inicioDiaZona,
  soloFecha,
} from '../lib/fechas.ts'
import { mensajeSinResultados } from '../lib/lista-vacia.ts'

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
  assert.match(bitacora, /agruparPorDia/)
  assert.match(bitacora, /hora12/)
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

test('el día civil no se corre y lo que falta dice Sin dato', () => {
  assert.equal(soloFecha('2026-10-20'), '20/10/2026')
  assert.equal(fechaDocumento('2026-10-21T00:28:00Z'), '20/10/2026')
  assert.equal(fechaDocumento(null), SIN_DATO)
  assert.equal(formatearFechaLista(''), SIN_DATO)
  assert.equal(encabezadoDia(INSTANTE), 'martes, 20 de octubre de 2026')
  assert.equal(hora12(INSTANTE), '7:28 p.m.')
  const grupos = agruparPorDia(
    [
      { id: 'tarde', creado_en: INSTANTE },
      { id: 'noche', creado_en: '2026-10-21T01:00:00Z' },
      { id: 'ayer', creado_en: '2026-10-20T04:00:00Z' },
    ],
    (item) => item.creado_en
  )
  assert.equal(grupos.length, 2)
  assert.equal(grupos[0].dia, 'martes, 20 de octubre de 2026')
  assert.deepEqual(grupos[0].items.map((item) => item.id), ['tarde', 'noche'])
  assert.equal(grupos[1].dia, 'lunes, 19 de octubre de 2026')
})

test('la lista vacía con filtro nombra lo buscado', () => {
  assert.equal(
    mensajeSinResultados('órdenes de compra', 'cable'),
    'No se encontraron órdenes de compra para "cable"'
  )
  assert.equal(
    mensajeSinResultados('eventos', ''),
    'No se encontraron eventos para "estos filtros"'
  )
  const ordenes = readFileSync('app/ordenes/page.tsx', 'utf8')
  const bitacora = readFileSync('app/bitacora/page.tsx', 'utf8')
  assert.match(ordenes, /Limpiar filtros/)
  assert.match(bitacora, /Limpiar filtros/)
  assert.match(bitacora, /mensajeSinResultados/)
})
