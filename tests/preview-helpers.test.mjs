import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  detectarTipoArchivo,
  obtenerExtensionArchivo,
  obtenerNombreArchivo,
  parsearCsvSimple,
} from '../lib/preview-helpers.ts'

test('detectarTipoArchivo reconoce imagen, PDF, CSV y XML', () => {
  assert.equal(detectarTipoArchivo('https://storage.example/factura.png'), 'image')
  assert.equal(detectarTipoArchivo('foto.JPEG'), 'image')
  assert.equal(detectarTipoArchivo('comprobante.webp?alt=media'), 'image')
  assert.equal(detectarTipoArchivo('data:image/png;base64,abc'), 'image')
  assert.equal(detectarTipoArchivo('archivo.bin', 'image/jpeg'), 'image')
  assert.equal(detectarTipoArchivo('https://example/doc.pdf?token=1'), 'pdf')
  assert.equal(detectarTipoArchivo('archivo', 'application/pdf'), 'pdf')
  assert.equal(detectarTipoArchivo('reporte.csv'), 'csv')
  assert.equal(detectarTipoArchivo('factura.xml'), 'xml')
  assert.equal(detectarTipoArchivo('log.txt'), 'text')
  assert.equal(detectarTipoArchivo('plantilla.xlsx'), 'spreadsheet')
  assert.equal(detectarTipoArchivo('https://example/desconocido'), 'generic')
})

test('la extensión y el nombre salen de la URL', () => {
  assert.equal(obtenerExtensionArchivo('https://url.com/factura.pdf?token=xyz'), 'pdf')
  assert.equal(obtenerExtensionArchivo('imagen.PNG'), 'png')
  assert.equal(obtenerExtensionArchivo('data:image/jpeg;base64,123'), 'jpg')
  assert.equal(obtenerExtensionArchivo('sin-extension'), '')
  assert.equal(obtenerNombreArchivo('https://url.com/12345.pdf', 'Factura.pdf'), 'Factura.pdf')
  assert.equal(obtenerNombreArchivo('https://url.com/comprobante-123.jpg?alt=media'), 'comprobante-123.jpg')
})

test('parsearCsvSimple respeta comillas y corta en 100 filas', () => {
  const csv = '"ID","Nombre con, coma"\n"10","Herramienta"\n'
  const resultado = parsearCsvSimple(csv)
  assert.deepEqual(resultado.cabeceras, ['ID', 'Nombre con, coma'])
  assert.deepEqual(resultado.filas[0], ['10', 'Herramienta'])
  assert.deepEqual(parsearCsvSimple(''), { cabeceras: [], filas: [] })

  const muchas = ['A', ...Array.from({ length: 120 }, (_, i) => String(i))].join('\n')
  assert.equal(parsearCsvSimple(muchas).filas.length, 100)
})
