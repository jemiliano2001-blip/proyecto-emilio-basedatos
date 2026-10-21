import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  LIMITE_FACTURA_BYTES,
  MINIMO_FACTURA_BYTES,
  adjuntarDesdeCtrlV,
  subirFacturaDirecto,
  validarArchivoFactura,
} from '../lib/adjuntos.ts'
import { VistaPreviaArchivo } from '../components/VistaPreviaArchivo.tsx'

const ORDEN_ID = '11111111-1111-4111-8111-111111111111'
const OBRA_ID = '22222222-2222-4222-8222-222222222222'

test('un PDF de 5 MB se sube a Storage y no entra en la server action', async () => {
  const tamano = 5 * 1024 * 1024
  assert.ok(tamano >= 1)
  assert.ok(MINIMO_FACTURA_BYTES >= 10 * 1024 * 1024)
  assert.ok(LIMITE_FACTURA_BYTES >= MINIMO_FACTURA_BYTES)
  assert.equal(validarArchivoFactura({
    name: 'factura-5mb.pdf',
    type: 'application/pdf',
    size: tamano,
  }).ok, true)

  const archivo = new File([new Uint8Array(tamano)], 'factura-5mb.pdf', {
    type: 'application/pdf',
  })
  assert.equal(archivo.size, tamano)

  const path = `ordenes/${ORDEN_ID}/facturas/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee-factura-5mb.pdf`
  const subidas = []
  const registros = []

  const resultado = await subirFacturaDirecto({
    archivo,
    ordenId: ORDEN_ID,
    obraId: OBRA_ID,
    folio: 'F-5',
    monto: '100.50',
    itemIds: [],
    preparar: async (input) => {
      assert.equal(input.tamano, tamano)
      assert.equal(input.nombre, 'factura-5mb.pdf')
      assert.equal(input.tipo, 'application/pdf')
      assert.equal('bytes' in input, false)
      return { error: null, path, tipo: 'pdf' }
    },
    storage: {
      upload: async (ruta, file, opciones) => {
        subidas.push({ ruta, file, opciones })
        return { error: null }
      },
    },
    registrar: async (fd) => {
      registros.push(fd)
      return { error: null }
    },
  })

  assert.deepEqual(resultado, { ok: true })
  assert.equal(subidas.length, 1)
  assert.equal(subidas[0].ruta, path)
  assert.equal(subidas[0].file, archivo)
  assert.equal(subidas[0].file.size, tamano)
  assert.equal(subidas[0].opciones.upsert, false)
  assert.equal(registros.length, 1)
  const fd = registros[0]
  assert.equal(fd.get('archivo'), null)
  assert.equal(fd.has('archivo'), false)
  assert.equal(fd.get('archivo_path'), path)
  assert.equal(fd.get('archivo_nombre'), 'factura-5mb.pdf')
  assert.equal(fd.get('tamano_bytes'), String(tamano))
  for (const valor of fd.values()) {
    assert.equal(valor instanceof File, false)
    assert.equal(typeof valor, 'string')
  }

  const accion = readFileSync('lib/actions/ordenes.ts', 'utf8')
  assert.equal(accion.includes("formData.get('archivo')"), false)
  assert.equal(accion.includes('.upload('), false)
  assert.match(accion, /prepararSubidaFacturaAction/)
  assert.match(accion, /registrarFacturaOrdenAction/)
})

test('pegar con Ctrl+V adjunta el archivo', () => {
  const archivo = new File([new Uint8Array([1, 2, 3, 4])], 'ticket.jpg', { type: 'image/jpeg' })
  const pegado = adjuntarDesdeCtrlV({
    key: 'v',
    ctrlKey: true,
    clipboardData: { files: [archivo] },
  })
  assert.equal(pegado.adjuntado, true)
  assert.equal(pegado.archivo, archivo)
  assert.equal(pegado.error, null)

  const texto = adjuntarDesdeCtrlV({
    key: 'v',
    ctrlKey: true,
    clipboardData: { files: [], items: [{ kind: 'string', getAsFile: () => null }] },
  })
  assert.equal(texto.adjuntado, false)
  assert.equal(texto.archivo, null)

  const sinCtrl = adjuntarDesdeCtrlV({
    key: 'v',
    ctrlKey: false,
    clipboardData: { files: [archivo] },
  })
  assert.equal(sinCtrl.adjuntado, false)

  const pesado = { name: 'grande.pdf', type: 'application/pdf', size: LIMITE_FACTURA_BYTES + 1 }
  const rechazo = adjuntarDesdeCtrlV({
    key: 'v',
    ctrlKey: true,
    clipboardData: { files: [pesado] },
  })
  assert.equal(rechazo.adjuntado, false)
  assert.match(rechazo.error ?? '', /30 MB/)
})

test('se ve la vista previa de imagen y de PDF', () => {
  const imagen = renderToStaticMarkup(
    React.createElement(VistaPreviaArchivo, {
      tipo: 'imagen',
      nombre: 'factura.jpg',
      src: 'blob:factura-local',
    })
  )
  assert.match(imagen, /Vista previa de factura\.jpg/)
  assert.match(imagen, /<img\b/)
  assert.match(imagen, /Vista previa/)
  assert.match(imagen, /data-vista-previa="imagen"/)

  const pdf = renderToStaticMarkup(
    React.createElement(VistaPreviaArchivo, {
      tipo: 'pdf',
      nombre: 'factura.pdf',
      src: '/api/ordenes/facturas/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    })
  )
  assert.match(pdf, /Vista previa del PDF factura\.pdf/)
  assert.match(pdf, /<iframe\b/)
  assert.match(pdf, /Vista previa/)
  assert.match(pdf, /data-vista-previa="pdf"/)

  const seccion = readFileSync('components/OrdenCompraFacturasSection.tsx', 'utf8')
  const adjunto = readFileSync('components/AdjuntarArchivo.tsx', 'utf8')
  assert.match(seccion, /VistaPreviaArchivo/)
  assert.match(seccion, /AdjuntarArchivo/)
  assert.match(adjunto, /Tomar foto/)
  assert.match(adjunto, /Elegir archivo/)
  assert.match(adjunto, /paste/)
  assert.match(adjunto, /VistaPreviaArchivo/)
})
