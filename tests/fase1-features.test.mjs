import test from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizarTelefonoWhatsApp,
  generarMensajeWhatsAppOrden,
  generarUrlWhatsApp,
} from '../lib/whatsapp-notificacion.ts'
import {
  puedeVibrar,
  vibrarTap,
  vibrarExito,
  vibrarAlerta,
  vibrarError,
} from '../lib/haptics.ts'
import { construirWorkbookFormal } from '../lib/excel-export-base.ts'

test('WhatsApp: normalización de números telefónicos mexicanos e internacionales', () => {
  // 10 dígitos estándar
  assert.equal(normalizarTelefonoWhatsApp('8112345678'), '528112345678')
  assert.equal(normalizarTelefonoWhatsApp('(81) 1234-5678'), '528112345678')
  assert.equal(normalizarTelefonoWhatsApp('81 1234 5678 '), '528112345678')

  // Con prefijo 1 (móvil legacy mexicano)
  assert.equal(normalizarTelefonoWhatsApp('+52 1 81 1234 5678'), '528112345678')

  // Con código país ya incluido (12 dígitos)
  assert.equal(normalizarTelefonoWhatsApp('528112345678'), '528112345678')

  // Inválido o vacío
  assert.equal(normalizarTelefonoWhatsApp(null), null)
  assert.equal(normalizarTelefonoWhatsApp(''), null)
  assert.equal(normalizarTelefonoWhatsApp('abc'), null)
  assert.equal(normalizarTelefonoWhatsApp('123'), null) // Menos de 10 dígitos
})

test('WhatsApp: generación estructurada de mensaje de orden de compra', () => {
  const mensaje = generarMensajeWhatsAppOrden({
    folio: 'OC-2026-0042',
    folioFisico: 'F-9021',
    obraNombre: 'Residencial Los Molinos',
    fraccionamiento: 'Sector Cumbres',
    proveedorNombre: 'Conductores y Conectores de México',
    solicitanteNombre: 'Manuel Gutiérrez',
    autorizadoPor: 'Thalía Compras',
    fechaEmision: '18/09/2026',
    moneda: 'MXN',
    total: 48500.5,
    notas: 'Entregar en caseta de vigilancia sector poniente',
    items: [
      {
        cantidad: 200,
        unidad: 'ML',
        descripcion: 'Cable de Cobre THW Calibre 2/0',
      },
      {
        cantidad: 4,
        unidad: 'PZA',
        descripcion: 'Registro Prefabricado Tipo 4',
      },
    ],
  })

  assert.match(mensaje, /OC-2026-0042/)
  assert.match(mensaje, /F-9021/)
  assert.match(mensaje, /Residencial Los Molinos/)
  assert.match(mensaje, /Sector Cumbres/)
  assert.match(mensaje, /Conductores y Conectores de México/)
  assert.match(mensaje, /Cable de Cobre THW Calibre 2\/0/)
  assert.match(mensaje, /200 ML/)
  assert.match(mensaje, /Registro Prefabricado Tipo 4/)
  assert.match(mensaje, /\$48,500\.50/)
  assert.match(mensaje, /Entregar en caseta de vigilancia sector poniente/)
  assert.match(mensaje, /Proyecto Emilio/)
})

test('WhatsApp: generación de URL web y app directa', () => {
  const urlConTel = generarUrlWhatsApp({
    telefono: '8112345678',
    mensaje: 'Hola orden',
  })
  assert.match(urlConTel, /^https:\/\/wa\.me\/528112345678\?text=/)
  assert.ok(urlConTel.includes('Hola%20orden'))

  const urlSinTel = generarUrlWhatsApp({
    telefono: null,
    mensaje: 'Mensaje sin destinatario',
  })
  assert.match(urlSinTel, /^https:\/\/api\.whatsapp\.com\/send\?text=/)
})

test('Haptics: resiliencia en entorno sin vibración (Node.js / SSR)', () => {
  assert.equal(puedeVibrar(), false)
  // Ninguna llamada debe arrojar excepción
  assert.equal(vibrarTap(), false)
  assert.equal(vibrarExito(), false)
  assert.equal(vibrarAlerta(), false)
  assert.equal(vibrarError(), false)
})

test('ExcelJS: construcción de Workbook formal con membrete Navy y bandas cebra', async () => {
  const workbook = await construirWorkbookFormal({
    nombreHoja: 'Prueba Conciliación',
    titulo: 'Conciliación de Materiales',
    subtitulo: 'Proyecto Test',
    metadatos: [
      { label: 'Obra', value: 'Los Molinos' },
      { label: 'Presupuesto', value: '$100,000.00 MXN' },
    ],
    columnas: [
      { header: 'Material', width: 30, align: 'left' },
      { header: 'Unidad', width: 10, align: 'center' },
      { header: 'Cantidad', width: 15, align: 'right', numFmt: '#,##0.00' },
      { header: 'Importe', width: 18, align: 'right', numFmt: '$#,##0.00' },
    ],
    filas: [
      ['Tubo Conduit PAD 2"', 'ML', 500, 25000],
      ['Transformador 75kVA', 'PZA', 1, 65000],
    ],
    totales: {
      labelColSpan: 3,
      label: 'Total General',
      valores: [{ colIndex: 4, valor: 90000, numFmt: '$#,##0.00' }],
    },
    orientacion: 'landscape',
  })

  assert.ok(workbook)
  const worksheet = workbook.getWorksheet('Prueba Conciliación')
  assert.ok(worksheet)
  assert.equal(worksheet.columns?.length, 4)

  // Verificar buffer exportable
  const buffer = await workbook.xlsx.writeBuffer()
  assert.ok(buffer)
  assert.ok(buffer.byteLength > 1000)
})
