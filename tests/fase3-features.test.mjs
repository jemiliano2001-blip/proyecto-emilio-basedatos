import test from 'node:test'
import assert from 'node:assert/strict'

import {
  obtenerLeadTimePorCategoria,
  diferenciaDias,
  estimarFechaEntrega,
  evaluarEstatusEntrega,
  LEAD_TIMES_POR_CATEGORIA,
} from '../lib/lead-time.ts'

test('Lead Times: clasificación correcta por categoría de material y severidad', () => {
  // Transformadores
  const ltTransfo = obtenerLeadTimePorCategoria('Transformador trifásico 75 KVA')
  assert.equal(ltTransfo.nivelCriticidad, 'alta')
  assert.equal(ltTransfo.diasPromedio, 25)

  // Registros de Concreto
  const ltRegistro = obtenerLeadTimePorCategoria('Registro Prefabricado de Concreto Tipo 4')
  assert.equal(ltRegistro.etiquetaCategoria, 'Registros de Concreto')
  assert.equal(ltRegistro.diasPromedio, 3)

  // Tubería PAD / Conduit
  const ltTuberia = obtenerLeadTimePorCategoria('Tuberia Conduit PAD 2 pulgadas')
  assert.equal(ltTuberia.etiquetaCategoria, 'Tubería y Canalización')
  assert.equal(ltTuberia.diasPromedio, 2)

  // Cableado
  const ltCable = obtenerLeadTimePorCategoria('Cable de Cobre THW Calibre 2/0')
  assert.equal(ltCable.etiquetaCategoria, 'Cableado y Conductores')
  assert.equal(ltCable.diasPromedio, 7)

  // Alumbrado Público
  const ltLuminaria = obtenerLeadTimePorCategoria('Luminaria LED 100W Alumbrado')
  assert.equal(ltLuminaria.etiquetaCategoria, 'Alumbrado Público')
  assert.equal(ltLuminaria.diasPromedio, 10)

  // Fallback defensivo
  const ltDefault = obtenerLeadTimePorCategoria('')
  assert.equal(ltDefault.etiquetaCategoria, 'Material General')
  assert.equal(ltDefault.diasPromedio, 5)
})

test('Lead Times: cálculo de diferencia en días entre fechas', () => {
  assert.equal(diferenciaDias('2026-09-01', '2026-09-05'), 4)
  assert.equal(diferenciaDias('2026-09-10', '2026-09-02'), -8)
  assert.equal(diferenciaDias('2026-09-18', '2026-09-18'), 0)
  // Fechas inválidas
  assert.equal(diferenciaDias('invalida', '2026-09-18'), 0)
})

test('Lead Times: estimación de fecha prometida de entrega', () => {
  const emision = '2026-09-10T10:00:00.000Z'
  const fechaEstimada = estimarFechaEntrega(emision, 'Tuberia Conduit') // 2 días promedio
  const delta = diferenciaDias(emision, fechaEstimada)
  assert.equal(delta, 2)
})

test('Lead Times: evaluación de orden entregada en tiempo', () => {
  const emision = '2026-09-01T12:00:00.000Z'
  const estimada = '2026-09-05T12:00:00.000Z'
  const recepcion = '2026-09-04T15:00:00.000Z' // 1 día antes de la meta

  const resultado = evaluarEstatusEntrega({
    fechaEmision: emision,
    fechaEntregaEstimada: estimada,
    fechaRecepcionReal: recepcion,
  })

  assert.equal(resultado.estado, 'entregado')
  assert.equal(resultado.esRetraso, false)
  assert.ok(resultado.textoDescriptivo.includes('Recibido en tiempo'))
})

test('Lead Times: evaluación de orden entregada con retraso', () => {
  const emision = '2026-09-01T12:00:00.000Z'
  const estimada = '2026-09-05T12:00:00.000Z'
  const recepcion = '2026-09-08T12:00:00.000Z' // 3 días después de la meta

  const resultado = evaluarEstatusEntrega({
    fechaEmision: emision,
    fechaEntregaEstimada: estimada,
    fechaRecepcionReal: recepcion,
  })

  assert.equal(resultado.estado, 'entregado')
  assert.equal(resultado.esRetraso, true)
  assert.equal(resultado.diasDiferencia, 3)
  assert.ok(resultado.textoDescriptivo.includes('demora'))
})

test('Lead Times: evaluación en tránsito a tiempo vs próximo a vencer vs retrasado', () => {
  const referenciaHoy = new Date('2026-09-10T12:00:00.000Z')

  // Caso 1: A tiempo (faltan 5 días)
  const r1 = evaluarEstatusEntrega({
    fechaEmision: '2026-09-05T12:00:00.000Z',
    fechaEntregaEstimada: '2026-09-15T12:00:00.000Z',
    fechaActualReferencia: referenciaHoy,
  })
  assert.equal(r1.estado, 'a_tiempo')
  assert.equal(r1.esRetraso, false)

  // Caso 2: Próximo a vencer (falta 1 día)
  const r2 = evaluarEstatusEntrega({
    fechaEmision: '2026-09-05T12:00:00.000Z',
    fechaEntregaEstimada: '2026-09-11T12:00:00.000Z',
    fechaActualReferencia: referenciaHoy,
  })
  assert.equal(r2.estado, 'proximo_a_vencer')
  assert.equal(r2.esRetraso, false)
  assert.equal(r2.textoDescriptivo, 'Vence mañana')

  // Caso 3: Retrasada (debió llegar hace 3 días)
  const r3 = evaluarEstatusEntrega({
    fechaEmision: '2026-09-01T12:00:00.000Z',
    fechaEntregaEstimada: '2026-09-07T12:00:00.000Z',
    fechaActualReferencia: referenciaHoy,
  })
  assert.equal(r3.estado, 'retrasado')
  assert.equal(r3.esRetraso, true)
  assert.equal(r3.diasDiferencia, 3)
  assert.equal(r3.textoDescriptivo, 'Retrasada por 3 días')
})

test('Auditoría Post-Fase: resiliencia a nulos, strings inválidos y prevención de NaN', async () => {
  const { sanitizarNombreArchivo } = await import('../lib/excel-export-base.ts')
  const { generarMensajeWhatsAppOrden } = await import('../lib/whatsapp-notificacion.ts')
  const { cotejarPartidasConOC } = await import('../lib/extractor-facturas-nativo.ts')

  // 1. Sanitización de nombres de archivo
  assert.equal(sanitizarNombreArchivo(null), 'archivo')
  assert.equal(sanitizarNombreArchivo(undefined), 'archivo')
  assert.equal(sanitizarNombreArchivo(''), 'archivo')
  assert.equal(sanitizarNombreArchivo('OC: 12/34 *? "demo"'), 'OC__12_34_____demo_')

  // 2. WhatsApp con items nulos o valores extremos
  const msgSeguro = generarMensajeWhatsAppOrden({
    folio: 'OC-9999',
    obraNombre: 'Obra Demo',
    proveedorNombre: 'Proveedor',
    items: null,
    total: NaN,
  })
  assert.ok(msgSeguro.includes('OC-9999'))
  assert.ok(!msgSeguro.includes('NaN'))

  // 3. Cotejo de partidas con entradas nulas
  const resCotejoNulo = cotejarPartidasConOC(null, null)
  assert.deepEqual(resCotejoNulo.itemsCoincidentesIds, [])
  assert.deepEqual(resCotejoNulo.desglose, [])

  // 4. Lead time ante fecha inválida sin propagar NaN
  const resFechaInvalida = evaluarEstatusEntrega({
    fechaEmision: 'fecha-totalmente-invalida',
  })
  assert.equal(resFechaInvalida.estado, 'a_tiempo')
  assert.equal(Number.isNaN(resFechaInvalida.diasTranscurridos), false)
  assert.equal(Number.isNaN(resFechaInvalida.diasRestantes), false)
  assert.equal(resFechaInvalida.textoDescriptivo, 'Fecha de emisión no disponible')
})
