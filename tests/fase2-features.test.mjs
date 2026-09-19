import test from 'node:test'
import assert from 'node:assert/strict'

import {
  parsearCfdiXml,
  extraerDatosDesdeNombreArchivo,
  cotejarPartidasConOC,
} from '../lib/extractor-facturas-nativo.ts'
import { generarMatrizQR } from '../lib/qr.ts'

// XML de muestra CFDI 4.0 representativo del SAT
const XML_CFDI_40_MUESTRA = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Serie="F" Folio="8841" Fecha="2026-09-18T14:30:00" SubTotal="25000.00" Total="29000.00" Moneda="MXN">
  <cfdi:Emisor Rfc="CON850101XYZ" Nombre="CONDUCTORES DEL NORTE SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="PEM010101AAA" Nombre="PROYECTO EMILIO SA DE CV" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="26121600" Cantidad="300" ClaveUnidad="MTR" Unidad="Metro" Descripcion="Cable de Cobre THW-LS Calibre 2/0 AWG Viakon" ValorUnitario="75.00" Importe="22500.00"/>
    <cfdi:Concepto ClaveProdServ="39121300" Cantidad="5" ClaveUnidad="H87" Unidad="Pieza" Descripcion="Registro Prefabricado de Concreto Tipo 4 CFE" ValorUnitario="500.00" Importe="2500.00"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital UUID="9A5B3210-4BCF-4180-87CD-F3910E4B8899" FechaTimbrado="2026-09-18T14:35:12"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`

// XML de muestra CFDI 3.3
const XML_CFDI_33_MUESTRA = `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/3" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="3.3" Folio="1042" Fecha="2026-08-10T11:00:00" SubTotal="10000.00" Total="11600.00" Moneda="MXN">
  <cfdi:Emisor Rfc="TUB990909ABC" Nombre="TUBERIAS Y CONEXIONES ELECTRICAS" RegimenFiscal="601"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="39121700" Cantidad="50" Unidad="Tramos" Descripcion="Tuberia Conduit PAD 2 pulgadas x 6m" ValorUnitario="200.00" Importe="10000.00"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital UUID="ABCDEF01-1234-5678-9ABC-DEF012345678"/>
  </cfdi:Complemento>
</cfdi:Comprobante>`

test('CFDI XML: extracción precisa de CFDI 4.0 sin IA', () => {
  const datos = parsearCfdiXml(XML_CFDI_40_MUESTRA)

  assert.ok(datos !== null)
  assert.equal(datos.esXmlCfdi, true)
  assert.equal(datos.folio, '8841')
  assert.equal(datos.serie, 'F')
  assert.equal(datos.folioCompleto, 'F-8841')
  assert.equal(datos.uuidFiscal, '9A5B3210-4BCF-4180-87CD-F3910E4B8899')
  assert.equal(datos.emisorRfc, 'CON850101XYZ')
  assert.equal(datos.emisorNombre, 'CONDUCTORES DEL NORTE SA DE CV')
  assert.equal(datos.subtotal, 25000)
  assert.equal(datos.total, 29000)
  assert.equal(datos.moneda, 'MXN')
  assert.equal(datos.fecha, '2026-09-18')
  assert.equal(datos.confianza, 'exacta_cfdi')

  // Partidas/Conceptos
  assert.equal(datos.conceptos.length, 2)
  assert.equal(datos.conceptos[0].cantidad, 300)
  assert.equal(datos.conceptos[0].descripcion, 'Cable de Cobre THW-LS Calibre 2/0 AWG Viakon')
  assert.equal(datos.conceptos[0].valorUnitario, 75)
  assert.equal(datos.conceptos[0].importe, 22500)
  assert.equal(datos.conceptos[0].claveProdServ, '26121600')

  assert.equal(datos.conceptos[1].cantidad, 5)
  assert.equal(datos.conceptos[1].descripcion, 'Registro Prefabricado de Concreto Tipo 4 CFE')
})

test('CFDI XML: extracción de CFDI 3.3 sin serie pero con folio y UUID', () => {
  const datos = parsearCfdiXml(XML_CFDI_33_MUESTRA)

  assert.ok(datos !== null)
  assert.equal(datos.esXmlCfdi, true)
  assert.equal(datos.folio, '1042')
  assert.equal(datos.serie, null)
  assert.equal(datos.folioCompleto, '1042')
  assert.equal(datos.uuidFiscal, 'ABCDEF01-1234-5678-9ABC-DEF012345678')
  assert.equal(datos.emisorRfc, 'TUB990909ABC')
  assert.equal(datos.total, 11600)
  assert.equal(datos.conceptos.length, 1)
})

test('CFDI XML: validación defensiva contra archivos no XML o corruptos', () => {
  assert.equal(parsearCfdiXml(''), null)
  assert.equal(parsearCfdiXml(null), null)
  assert.equal(parsearCfdiXml('<html><body>No es CFDI</body></html>'), null)
  assert.equal(parsearCfdiXml('{"json": "invalido"}'), null)
})

test('Heurísticas de nombre de archivo: extracción de folios y fechas', () => {
  // Caso 1: Remisión típica con fecha ISO
  const r1 = extraerDatosDesdeNombreArchivo('REM-1049_Viakon_2026-09-18.pdf')
  assert.equal(r1.folioSugerido, 'REM-1049')
  assert.equal(r1.fechaSugerida, '2026-09-18')

  // Caso 2: Factura con guión bajo y fecha mexicana DD-MM-YYYY
  const r2 = extraerDatosDesdeNombreArchivo('Factura_A-9921_15-08-2026.png')
  assert.equal(r2.folioSugerido, 'FACTURA-A-9921')
  assert.equal(r2.fechaSugerida, '2026-08-15')

  // Caso 3: Archivo nombrado con UUID
  const r3 = extraerDatosDesdeNombreArchivo('9a5b3210-4bcf-4180-87cd-f3910e4b8899.xml')
  assert.equal(r3.folioSugerido, '9A5B3210')

  // Caso 4: Archivo genérico
  const r4 = extraerDatosDesdeNombreArchivo('foto_remision_obra.jpg')
  assert.equal(r4.folioSugerido, null)
  assert.equal(r4.fechaSugerida, null)

  // Caso 5: Archivo vacío
  const r5 = extraerDatosDesdeNombreArchivo('')
  assert.equal(r5.folioSugerido, null)
  assert.equal(r5.fechaSugerida, null)
})

test('Cotejo inteligente de partidas con Orden de Compra', () => {
  const conceptosFactura = [
    { descripcion: 'Cable de Cobre THW-LS Calibre 2/0 AWG Viakon', cantidad: 300 },
    { descripcion: 'Registro Prefabricado Concreto Tipo 4 CFE', cantidad: 5 },
    { descripcion: 'Flete y maniobra especializada', cantidad: 1 },
  ]

  const itemsOC = [
    { id: 'item-1', nombre: 'Cable de Cobre THW Calibre 2/0', cantidad: 300 },
    { id: 'item-2', nombre: 'Registro Prefabricado Tipo 4', cantidad: 5 },
    { id: 'item-3', nombre: 'Transformador Trifásico 75 KVA', cantidad: 1 },
  ]

  const resultado = cotejarPartidasConOC(conceptosFactura, itemsOC)

  // Debe coincidir item-1 (Cable) e item-2 (Registro), pero no item-3 (Transformador)
  assert.ok(resultado.itemsCoincidentesIds.includes('item-1'))
  assert.ok(resultado.itemsCoincidentesIds.includes('item-2'))
  assert.equal(resultado.itemsCoincidentesIds.includes('item-3'), false)
  assert.equal(resultado.itemsCoincidentesIds.length, 2)

  // Desglose debe reportar similitud
  const detalleCable = resultado.desglose.find((d) => d.ordenItemId === 'item-1')
  assert.ok(detalleCable)
  assert.ok(detalleCable.similitud > 50)
})

test('Generador QR Nativo Vectorial: matriz ISO/IEC 18004', () => {
  // Matriz para texto corto (V2 = 25x25)
  const matrizV2 = generarMatrizQR('emilio:oc:123')
  assert.equal(matrizV2.length, 25)
  assert.equal(matrizV2[0].length, 25)

  // Finders 7x7 en las esquinas: (0,0), (0,6), (6,0) deben ser true
  assert.equal(matrizV2[0][0], true)
  assert.equal(matrizV2[0][6], true)
  assert.equal(matrizV2[6][0], true)
  // Centro del finder (2,2) debe ser true
  assert.equal(matrizV2[2][2], true)
  // Separador interior (1,1) debe ser false
  assert.equal(matrizV2[1][1], false)

  // Matriz para texto largo (V3 = 29x29)
  const textoLargo = 'emilio:oc:orden-compra-con-id-sumamente-largo-para-test-2026'
  const matrizV3 = generarMatrizQR(textoLargo)
  assert.equal(matrizV3.length, 29)
  assert.equal(matrizV3[0].length, 29)
})
