import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChecklistRecepcionPasos } from '../components/ChecklistRecepcionPasos.tsx'
import {
  MENSAJE_BORRADOR_GRANDE,
  MENSAJE_CANTIDAD_MAYOR,
  MENSAJE_FALTA_CANTIDAD,
  MENSAJE_FALTA_FOTO_MAL,
  MENSAJE_FALTA_REVISAR,
  MENSAJE_FALTA_TALON,
  MENSAJE_NADA_LLEGO,
  MENSAJE_TODO_BIEN,
  archivoAFoto,
  contarRevisados,
  etiquetaLlegadaPedido,
  exigeFotoItem,
  fotoABytes,
  fusionarRenglones,
  guardarBorrador,
  itemDesdeRenglon,
  leerBorrador,
  motivoBloqueo,
  noLlegaron,
  puedeTerminar,
  renglonVacio,
  revisarIncompleto,
  resumir,
} from '../lib/checklist-recepcion.ts'

function material(id, esperado = 10) {
  return {
    orden_item_id: id,
    nombre: 'Material de ejemplo',
    unidad: 'pzas',
    esperado,
  }
}

function almacenVacio() {
  const datos = new Map()
  return {
    datos,
    leer: (clave) => datos.get(clave) ?? null,
    guardar: (clave, valor) => {
      datos.set(clave, valor)
    },
    borrar: (clave) => {
      datos.delete(clave)
    },
  }
}

function borradorBase(parcial = {}) {
  return {
    version: 1,
    ordenId: 'orden-1',
    paso: 2,
    recepcionId: 'rec-1',
    quienEntrego: 'Chofer de ejemplo',
    pendienteEnvio: false,
    renglones: [],
    talon: null,
    extras: [],
    ...parcial,
  }
}

test('no deja terminar si falta un material o la foto del talón', () => {
  const materiales = [material('a', 4), material('b', 2)]
  const soloUno = [
    { ...renglonVacio('a'), marca: 'llego' },
    renglonVacio('b'),
  ]
  assert.equal(puedeTerminar(materiales, soloUno, true), false)
  assert.equal(motivoBloqueo(materiales, soloUno, true), MENSAJE_FALTA_REVISAR)

  const ambos = soloUno.map((r) => ({ ...r, marca: 'llego' }))
  assert.equal(puedeTerminar(materiales, ambos, false), false)
  assert.equal(motivoBloqueo(materiales, ambos, false), MENSAJE_FALTA_TALON)
  assert.equal(puedeTerminar(materiales, ambos, true), true)
})

test('incompleto pide cantidad y foto', () => {
  const pedido = material('a', 100)
  assert.equal(revisarIncompleto(100, null, null, false).error, MENSAJE_FALTA_CANTIDAD)
  assert.equal(revisarIncompleto(100, 90, null, true).error, MENSAJE_FALTA_CANTIDAD)
  assert.equal(revisarIncompleto(100, 0, 0, true).error, MENSAJE_NADA_LLEGO)
  assert.equal(revisarIncompleto(100, 100, 0, true).error, MENSAJE_TODO_BIEN)
  assert.equal(revisarIncompleto(100, 90, 20, true).error, MENSAJE_CANTIDAD_MAYOR)
  assert.equal(revisarIncompleto(100, 90, 6, false).error, MENSAJE_FALTA_FOTO_MAL)

  const listo = revisarIncompleto(100, 90, 6, true)
  assert.equal(listo.ok, true)
  assert.equal(listo.faltan, 4)
  assert.equal(noLlegaron(100, 90, 6), 4)
  assert.equal(
    puedeTerminar(
      [pedido],
      [{ ...renglonVacio('a'), marca: 'incompleto', bien: 90, rotos: 6, tieneFoto: false }],
      true
    ),
    false
  )
  assert.equal(
    puedeTerminar(
      [pedido],
      [{ ...renglonVacio('a'), marca: 'incompleto', bien: 90, rotos: 6, tieneFoto: true }],
      true
    ),
    true
  )
})

test('llegó llena la cantidad y no llegó queda en cero', () => {
  const pedido = material('a', 40)
  const llego = itemDesdeRenglon(pedido, { ...renglonVacio('a'), marca: 'llego' })
  assert.equal(llego.ok, true)
  assert.equal(llego.item.cantidad_recibida, 40)
  assert.equal(llego.item.cantidad_danada, 0)
  assert.equal(llego.item.estado, 'completo')

  const nada = itemDesdeRenglon(pedido, { ...renglonVacio('a'), marca: 'no_llego' })
  assert.equal(nada.item.estado, 'faltante')
  assert.equal(nada.item.cantidad_recibida, 0)
  assert.equal(nada.item.cantidad_danada, 0)
  assert.equal(nada.item.observacion, 'No llegó')

  const incompleto = itemDesdeRenglon(pedido, {
    ...renglonVacio('a'),
    marca: 'incompleto',
    bien: 30,
    rotos: 4,
    tieneFoto: true,
  })
  assert.equal(incompleto.item.estado, 'danado')
  assert.equal(incompleto.item.cantidad_recibida, 30)
  assert.equal(incompleto.item.cantidad_danada, 4)
  assert.equal(exigeFotoItem(incompleto.item.estado, incompleto.item.cantidad_danada), true)
  assert.equal(exigeFotoItem('completo', 0), false)
})

test('el contador dice cuántos van revisados', () => {
  const materiales = Array.from({ length: 10 }, (_, i) => material(`m${i}`, 1))
  const renglones = materiales.map((row, i) =>
    i < 7 ? { ...renglonVacio(row.orden_item_id), marca: 'llego' } : renglonVacio(row.orden_item_id)
  )
  assert.equal(contarRevisados(materiales, renglones).texto, '7 de 10 revisados')
})

test('el resumen separa llegó, falta y dañado', () => {
  const materiales = [material('a', 10), material('b', 10), material('c', 100)]
  const resumen = resumir(materiales, [
    { ...renglonVacio('a'), marca: 'llego' },
    { ...renglonVacio('b'), marca: 'no_llego' },
    { ...renglonVacio('c'), marca: 'incompleto', bien: 90, rotos: 6, tieneFoto: true },
  ])
  assert.equal(resumen.llego.length, 1)
  assert.equal(resumen.falta[0].texto, 'No llegó')
  assert.match(resumen.danado[0].texto, /90 pzas bien/)
  assert.match(resumen.danado[0].texto, /4 pzas no llegaron/)
})

test('el borrador se guarda y se recupera', () => {
  const almacen = almacenVacio()
  const foto = archivoAFoto(Uint8Array.from([1, 2, 3, 4]), 'talon.jpg', 'image/jpeg')
  const original = borradorBase({
    paso: 3,
    talon: foto,
    renglones: [
      {
        orden_item_id: 'a',
        marca: 'llego',
        bien: null,
        rotos: null,
        nota: '',
        foto: null,
      },
    ],
  })
  assert.deepEqual(guardarBorrador(almacen, original), { ok: true })
  const leido = leerBorrador(almacen, 'orden-1')
  assert.deepEqual(leido, original)
  assert.deepEqual(fotoABytes(leido.talon), Uint8Array.from([1, 2, 3, 4]))

  const materiales = [material('a', 4), material('b', 2)]
  const fusion = fusionarRenglones(materiales, leido)
  assert.equal(fusion[0].marca, 'llego')
  assert.equal(fusion[1].marca, null)
  assert.equal(fusion.length, 2)
})

test('un borrador dañado no borra el avance en memoria y la cuota avisa claro', () => {
  const almacen = almacenVacio()
  almacen.guardar('checklist-recepcion:orden-1', '{no es json')
  assert.equal(leerBorrador(almacen, 'orden-1'), null)

  const lleno = {
    leer: () => null,
    guardar: () => {
      throw new Error('quota')
    },
    borrar: () => {},
  }
  const resultado = guardarBorrador(lleno, borradorBase())
  assert.equal(resultado.ok, false)
  assert.equal(resultado.error, MENSAJE_BORRADOR_GRANDE)
})

test('por recibir y llegó una parte se dicen en palabras simples', () => {
  assert.equal(etiquetaLlegadaPedido('emitida'), 'Por recibir')
  assert.equal(etiquetaLlegadaPedido('parcialmente_recibida'), 'Llegó una parte')
})

test('a 390px la lista es una columna y Terminar respeta las reglas', () => {
  const noop = () => {}
  const materiales = [
    {
      ...material('a', 10),
      marca: 'llego',
      bien: null,
      rotos: null,
      nota: '',
      tieneFoto: false,
    },
    {
      ...material('b', 10),
      marca: null,
      bien: null,
      rotos: null,
      nota: '',
      tieneFoto: false,
    },
  ]
  const base = {
    folio: 'OC de ejemplo',
    obraNombre: 'Proyecto de ejemplo',
    quienEntrego: '',
    aviso: null,
    zonaTalon: React.createElement('p', null, 'Tomar foto Elegir archivo Ctrl + V'),
    fotosExtra: React.createElement('p', null, 'Fotos extra'),
    zonaFotoRenglon: () => null,
    onAtras: noop,
    onSiguiente: noop,
    onMarca: noop,
    onBien: noop,
    onRotos: noop,
    onNota: noop,
    onQuien: noop,
    onTerminar: noop,
  }

  const lista = renderToStaticMarkup(
    React.createElement(ChecklistRecepcionPasos, { ...base, paso: 2, materiales, tieneTalon: false })
  )
  assert.match(lista, /data-checklist="recepcion"/)
  assert.match(lista, /class="flex w-full flex-col gap-4"/)
  assert.match(lista, /min-h-14 w-full/)
  assert.match(lista, /text-base/)
  assert.match(lista, /7 de 10 revisados|1 de 2 revisados/)
  assert.match(lista, /✅ Llegó/)
  assert.match(lista, /⚠️ Llegó incompleto o dañado/)
  assert.match(lista, /❌ No llegó/)
  assert.equal(lista.includes('grid-cols-2') || lista.includes('grid-cols-3'), false)
  assert.ok(lista.includes('disabled=""'))
  assert.match(lista, /Falta revisar unos materiales/)

  const foto = renderToStaticMarkup(
    React.createElement(ChecklistRecepcionPasos, {
      ...base,
      paso: 3,
      materiales: materiales.map((row) => ({ ...row, marca: 'llego' })),
      tieneTalon: false,
    })
  )
  assert.match(foto, /Foto del talón o remisión/)
  assert.match(foto, /Tomar foto Elegir archivo Ctrl \+ V/)
  assert.match(foto, /Falta la foto del talón/)
  assert.equal(foto.includes('grid-cols-2') || foto.includes('grid-cols-3'), false)

  const resumen = renderToStaticMarkup(
    React.createElement(ChecklistRecepcionPasos, {
      ...base,
      paso: 4,
      materiales: materiales.map((row) => ({ ...row, marca: 'llego' })),
      tieneTalon: true,
    })
  )
  assert.match(resumen, /Terminar/)
  assert.match(resumen, /Llegó/)
  assert.match(resumen, /Falta/)
  assert.match(resumen, /Dañado/)
  assert.equal(resumen.includes('disabled=""'), false)

  const sinTalon = renderToStaticMarkup(
    React.createElement(ChecklistRecepcionPasos, {
      ...base,
      paso: 4,
      materiales: materiales.map((row) => ({ ...row, marca: 'llego' })),
      tieneTalon: false,
    })
  )
  assert.match(sinTalon, /data-terminar="1"/)
  assert.ok(sinTalon.includes('disabled=""'))
  assert.match(sinTalon, /Falta la foto del talón/)
})

test('la pantalla de pedidos y la acción usan el checklist sin pedir columnas nuevas', () => {
  const lista = readFileSync('app/recepciones/page.tsx', 'utf8')
  const recibir = readFileSync('app/ordenes/[id]/recibir/page.tsx', 'utf8')
  const accion = readFileSync('lib/actions/recepciones.ts', 'utf8')
  const adjunto = readFileSync('components/ChecklistRecepcion.tsx', 'utf8')
  assert.match(lista, /¿Qué pedido llegó\?/)
  assert.match(lista, /ListaPedidosLlegados/)
  const pedidos = readFileSync('components/ListaPedidosLlegados.tsx', 'utf8')
  assert.match(pedidos, /etiquetaLlegadaPedido/)
  assert.match(pedidos, /min-h-14 w-full flex-col/)
  assert.doesNotMatch(lista, /orden\.estado\.replaceAll/)
  assert.match(recibir, /ChecklistRecepcion/)
  assert.match(recibir, /Recibir material|folio=\{cabecera\.folio\}/)
  assert.doesNotMatch(recibir, /Checklist ·/)
  assert.match(accion, /origen_checklist/)
  assert.match(accion, /Falta la foto del talón/)
  assert.match(adjunto, /AdjuntarArchivo/)
  assert.match(adjunto, /Elegir archivo/)
  assert.match(adjunto, /Ctrl \+ V/)
  assert.match(adjunto, /localStorage/)
})
