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
  assert.notEqual(subidas[0].file, archivo)
  assert.equal(subidas[0].file.name, 'factura-5mb.pdf')
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

function itemDe(archivo) {
  return { kind: 'file', type: archivo.type, getAsFile: () => archivo }
}

test('pegar con Ctrl+V adjunta imagen o PDF y no roba el texto', () => {
  const archivo = new File([new Uint8Array([1, 2, 3, 4])], 'ticket.jpg', { type: 'image/jpeg' })
  const pegado = adjuntarDesdeCtrlV({
    key: 'v',
    ctrlKey: true,
    destino: 'pagina',
    clipboardData: { items: [itemDe(archivo)] },
  })
  assert.equal(pegado.adjuntado, true)
  assert.equal(pegado.archivo, archivo)
  assert.equal(pegado.aviso, 'Captura del portapapeles detectada.')

  const enCampo = adjuntarDesdeCtrlV({
    destino: 'campo',
    clipboardData: { items: [itemDe(archivo)] },
  })
  assert.equal(enCampo.adjuntado, true)

  const pdf = new File([new Uint8Array([1, 2])], 'factura.pdf', { type: 'application/pdf' })
  const pdfPegado = adjuntarDesdeCtrlV({
    destino: 'pagina',
    clipboardData: { files: [pdf] },
  })
  assert.equal(pdfPegado.adjuntado, true)
  assert.equal(pdfPegado.archivo, pdf)

  const texto = adjuntarDesdeCtrlV({
    destino: 'campo',
    clipboardData: { items: [{ kind: 'string', type: 'text/plain', getAsFile: () => null }] },
  })
  assert.equal(texto.adjuntado, false)
  assert.equal(texto.archivo, null)
  assert.equal(texto.error, null)

  const sinCtrl = adjuntarDesdeCtrlV({
    key: 'v',
    ctrlKey: false,
    clipboardData: { items: [itemDe(archivo)] },
  })
  assert.equal(sinCtrl.adjuntado, false)

  const ya = adjuntarDesdeCtrlV({
    yaHayArchivo: true,
    clipboardData: { items: [itemDe(archivo)] },
  })
  assert.equal(ya.adjuntado, false)

  const pesado = { name: 'grande.jpg', type: 'image/jpeg', size: LIMITE_FACTURA_BYTES + 1 }
  const rechazo = adjuntarDesdeCtrlV({
    clipboardData: { items: [itemDe(pesado)] },
  })
  assert.equal(rechazo.adjuntado, false)
  assert.match(rechazo.error ?? '', /no puede exceder 30 MB/)

  const formato = validarArchivoFactura({ name: 'notas.txt', type: 'text/plain', size: 20 })
  assert.equal(formato.ok, false)
  assert.match(formato.error, /Formato no válido/)

  const gif = validarArchivoFactura({ name: 'foto.gif', type: 'image/gif', size: 40 })
  assert.equal(gif.ok, true)
})

test('se ve la vista previa de imagen y de PDF', () => {
  const imagen = renderToStaticMarkup(
    React.createElement(VistaPreviaArchivo, {
      tipo: 'imagen',
      nombre: 'factura.jpg',
      src: 'blob:factura-local',
    })
  )
  assert.match(imagen, /alt="Factura"/)
  assert.match(imagen, /<img\b/)
  assert.match(imagen, /factura\.jpg/)
  assert.match(imagen, /data-vista-previa="imagen"/)

  const pdf = renderToStaticMarkup(
    React.createElement(VistaPreviaArchivo, {
      tipo: 'pdf',
      nombre: 'factura.pdf',
      src: '/api/ordenes/facturas/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    })
  )
  assert.match(pdf, /title="Vista previa PDF"/)
  assert.match(pdf, /<iframe\b/)
  assert.match(pdf, /factura\.pdf/)
  assert.match(pdf, /data-vista-previa="pdf"/)

  const seccion = readFileSync('components/OrdenCompraFacturasSection.tsx', 'utf8')
  const adjunto = readFileSync('components/AdjuntarArchivo.tsx', 'utf8')
  const visor = readFileSync('components/QuickLookModal.tsx', 'utf8')
  assert.match(seccion, /VistaPreviaArchivo/)
  assert.match(seccion, /AdjuntarArchivo/)
  assert.match(seccion, /disabled=\{isPending \|\| !archivo\}/)
  assert.match(seccion, /'Guardar'/)
  assert.match(adjunto, /Tomar foto/)
  assert.match(adjunto, /Haz clic o arrastra un screenshot o PDF/)
  assert.match(adjunto, /O presiona Ctrl \+ V/)
  assert.match(adjunto, /window\.addEventListener\('paste'/)
  assert.match(adjunto, /VistaPreviaArchivo/)
  assert.match(adjunto, /Quitar/)
  assert.match(visor, /Ajustar/)
  assert.match(visor, /Girar/)
  assert.match(visor, />Descargar</)
  assert.match(visor, />Cerrar</)
  assert.equal(visor.includes('>Eliminar<'), false)
})

test('si el registro falla, el reintento no vuelve a subir', async () => {
  const archivo = new File([new Uint8Array([1, 2, 3, 4])], 'ticket.jpg', { type: 'image/jpeg' })
  const path = `ordenes/${ORDEN_ID}/facturas/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee-ticket.jpg`
  const pendiente = { path: null }
  let subidas = 0

  const base = {
    archivo,
    ordenId: ORDEN_ID,
    obraId: OBRA_ID,
    itemIds: [],
    pendiente,
    preparar: async () => ({ error: null, path, tipo: 'imagen' }),
    storage: {
      upload: async () => {
        subidas += 1
        return { error: null }
      },
    },
  }

  const primero = await subirFacturaDirecto({
    ...base,
    registrar: async () => ({ error: 'No se pudo guardar la factura.' }),
  })
  assert.equal(primero.ok, false)
  assert.equal(subidas, 1)
  assert.equal(pendiente.path, path)

  const segundo = await subirFacturaDirecto({
    ...base,
    registrar: async () => ({ error: null }),
  })
  assert.deepEqual(segundo, { ok: true })
  assert.equal(subidas, 1)
  assert.equal(pendiente.path, null)
})
