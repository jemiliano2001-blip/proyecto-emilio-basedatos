'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AdjuntarArchivo } from '@/components/AdjuntarArchivo'
import { ChecklistRecepcionPasos, type MaterialVista } from '@/components/ChecklistRecepcionPasos'
import { SelectorFoto } from '@/components/SelectorFoto'
import type { ActionResult } from '@/lib/actions/recepciones'
import {
  CLASE_BOTON_GRANDE,
  MENSAJE_FALTA_REVISAR,
  MENSAJE_FALTA_TALON,
  MENSAJE_SIN_SENAL,
  aRenglonChecklist,
  archivoAFotoFile,
  borrarBorrador,
  errorDeRenglon,
  fotoAArchivo,
  fusionarRenglones,
  guardarBorrador,
  itemDesdeRenglon,
  leerBorrador,
  materialesPorRecibir,
  motivoBloqueo,
  motivoMateriales,
  validarFotoRecepcion,
  type AlmacenBorrador,
  type BorradorChecklist,
  type MarcaChecklist,
  type PasoChecklist,
  type RenglonBorrador,
} from '@/lib/checklist-recepcion'
import type { OrdenItemChecklist } from '@/lib/types'

type VistaMaterial = 'lista' | 'marca' | 'detalle'

function almacenNavegador(): AlmacenBorrador {
  return {
    leer: (clave) => window.localStorage.getItem(clave),
    guardar: (clave, valor) => window.localStorage.setItem(clave, valor),
    borrar: (clave) => window.localStorage.removeItem(clave),
  }
}

export function ChecklistRecepcion({
  action,
  ordenId,
  folio,
  obraNombre,
  items,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>
  ordenId: string
  folio: string
  obraNombre: string
  items: OrdenItemChecklist[]
}) {
  const router = useRouter()
  const materiales = useMemo(() => materialesPorRecibir(items), [items])
  const [cargado, setCargado] = useState(false)
  const [paso, setPaso] = useState<PasoChecklist>(2)
  const [indice, setIndice] = useState(0)
  const [vistaMaterial, setVistaMaterial] = useState<VistaMaterial>('lista')
  const [renglones, setRenglones] = useState<RenglonBorrador[]>([])
  const [quien, setQuien] = useState('')
  const [talon, setTalon] = useState<File | null>(null)
  const [extras, setExtras] = useState<File[]>([])
  const [fotos, setFotos] = useState<Record<string, File>>({})
  const [aviso, setAviso] = useState<string | null>(null)
  const [antesDeTodo, setAntesDeTodo] = useState<RenglonBorrador[] | null>(null)
  const recepcionId = useRef('')
  const pendienteEnvio = useRef(false)
  const talonFoto = useRef<BorradorChecklist['talon']>(null)
  const extrasFoto = useRef<BorradorChecklist['extras']>([])
  const enviando = useRef(false)
  const temporizador = useRef<number | null>(null)
  const respaldo = useRef<BorradorChecklist | null>(null)
  const pasoRef = useRef<PasoChecklist>(2)
  const indiceRef = useRef(0)
  const vistaRef = useRef<VistaMaterial>('lista')
  const quienRef = useRef('')
  const renglonesRef = useRef<RenglonBorrador[]>([])
  const talonRef = useRef<File | null>(null)
  const extrasRef = useRef<File[]>([])
  const fotosRef = useRef<Record<string, File>>({})
  const [state, formAction] = useActionState(action, { error: null })

  pasoRef.current = paso
  indiceRef.current = indice
  vistaRef.current = vistaMaterial
  quienRef.current = quien
  renglonesRef.current = renglones
  talonRef.current = talon
  extrasRef.current = extras
  fotosRef.current = fotos

  function armarBorrador(
    pasoActual: PasoChecklist,
    filas: RenglonBorrador[],
    quienActual: string
  ): BorradorChecklist {
    return {
      version: 1,
      ordenId,
      paso: pasoActual,
      recepcionId: recepcionId.current,
      quienEntrego: quienActual,
      pendienteEnvio: pendienteEnvio.current,
      renglones: filas,
      talon: talonFoto.current,
      extras: extrasFoto.current,
    }
  }

  function cancelarGuardadoDiferido() {
    if (temporizador.current !== null) window.clearTimeout(temporizador.current)
    temporizador.current = null
  }

  function persistir(borrador: BorradorChecklist) {
    cancelarGuardadoDiferido()
    const resultado = guardarBorrador(almacenNavegador(), borrador)
    if (!resultado.ok) setAviso(resultado.error)
  }

  /** Para cada tecla: espera a que dejes de escribir en vez de reescribir las fotos en cada letra. */
  function persistirDiferido() {
    cancelarGuardadoDiferido()
    temporizador.current = window.setTimeout(() => {
      temporizador.current = null
      persistir(armarBorrador(pasoRef.current, renglonesRef.current, quienRef.current))
    }, 400)
  }

  const guardarPendienteRef = useRef(() => {})
  guardarPendienteRef.current = () => {
    if (temporizador.current === null) return
    persistir(armarBorrador(pasoRef.current, renglonesRef.current, quienRef.current))
  }

  useEffect(() => {
    const salir = () => guardarPendienteRef.current()
    const alOcultar = () => {
      if (document.visibilityState === 'hidden') salir()
    }
    window.addEventListener('pagehide', salir)
    document.addEventListener('visibilitychange', alOcultar)
    return () => {
      window.removeEventListener('pagehide', salir)
      document.removeEventListener('visibilitychange', alOcultar)
      salir()
    }
  }, [])

  useEffect(() => {
    const guardado = leerBorrador(almacenNavegador(), ordenId)
    recepcionId.current = guardado?.recepcionId ?? crypto.randomUUID()
    const filas = fusionarRenglones(materiales, guardado)
    const pasoGuardado = guardado?.paso ?? 2
    const quienGuardado = guardado?.quienEntrego ?? ''
    pendienteEnvio.current = guardado?.pendienteEnvio === true
    talonFoto.current = guardado?.talon ?? null
    extrasFoto.current = guardado?.extras ?? []
    setRenglones(filas)
    setPaso(pasoGuardado)
    setQuien(quienGuardado)
    setTalon(guardado?.talon ? fotoAArchivo(guardado.talon) : null)
    setExtras((guardado?.extras ?? []).map((foto) => fotoAArchivo(foto)))
    const mapa: Record<string, File> = {}
    for (const fila of filas) {
      if (fila.foto) mapa[fila.orden_item_id] = fotoAArchivo(fila.foto)
    }
    setFotos(mapa)
    indiceRef.current = 0
    vistaRef.current = 'lista'
    setIndice(0)
    setVistaMaterial('lista')
    if (guardado?.pendienteEnvio) setAviso(MENSAJE_SIN_SENAL)
    setCargado(true)
  }, [materiales, ordenId])

  useEffect(() => {
    if (!state.error || !enviando.current) return
    enviando.current = false
    pendienteEnvio.current = true
    if (respaldo.current) {
      respaldo.current = { ...respaldo.current, pendienteEnvio: true }
      guardarBorrador(almacenNavegador(), respaldo.current)
    }
    setAviso(state.error)
  }, [state.error])

  useEffect(() => {
    if (!antesDeTodo) return
    const id = window.setTimeout(() => setAntesDeTodo(null), 5000)
    return () => window.clearTimeout(id)
  }, [antesDeTodo])

  function cambiarFilas(filas: RenglonBorrador[], diferido = false) {
    setAntesDeTodo(null)
    setRenglones(filas)
    renglonesRef.current = filas
    if (diferido) {
      persistirDiferido()
      return
    }
    persistir(armarBorrador(pasoRef.current, filas, quienRef.current))
  }

  function colocar(donde: number, vista: VistaMaterial) {
    indiceRef.current = donde
    vistaRef.current = vista
    setIndice(donde)
    setVistaMaterial(vista)
  }

  function volverALista() {
    colocar(indiceRef.current, 'lista')
  }

  function onMarca(ordenItemId: string, marca: MarcaChecklist) {
    const filas = renglonesRef.current.map((fila) => {
      if (fila.orden_item_id !== ordenItemId) return fila
      if (marca === 'incompleto' && fila.rotos === null) return { ...fila, marca, rotos: 0 }
      return { ...fila, marca }
    })
    cambiarFilas(filas)
    setAviso(null)
    if (marca === 'incompleto') {
      const donde = materiales.findIndex((material) => material.orden_item_id === ordenItemId)
      colocar(donde < 0 ? indiceRef.current : donde, 'detalle')
      return
    }
    volverALista()
  }

  function onAlternar(ordenItemId: string) {
    const fila = renglonesRef.current.find((row) => row.orden_item_id === ordenItemId)
    if (!fila) return
    if (fila.marca !== null && fila.marca !== 'llego') {
      colocar(materiales.findIndex((m) => m.orden_item_id === ordenItemId), 'marca')
      return
    }
    const marca = fila.marca === 'llego' ? null : 'llego'
    cambiarFilas(
      renglonesRef.current.map((row) => (row === fila ? { ...row, marca } : row))
    )
    setAviso(null)
  }

  function onTodoLlego() {
    const previas = renglonesRef.current
    if (!previas.some((fila) => fila.marca === null)) {
      if (previas.every((fila) => fila.marca === 'llego')) {
        cambiarFilas(previas.map((fila) => ({ ...fila, marca: null })))
      }
      return
    }
    cambiarFilas(previas.map((fila) => (fila.marca === null ? { ...fila, marca: 'llego' } : fila)))
    setAntesDeTodo(previas)
    setAviso(null)
  }

  function onDeshacer() {
    if (antesDeTodo) cambiarFilas(antesDeTodo)
    setAntesDeTodo(null)
  }

  function onBien(ordenItemId: string, valor: number | null) {
    cambiarFilas(
      renglonesRef.current.map((fila) =>
        fila.orden_item_id === ordenItemId ? { ...fila, bien: valor } : fila
      ),
      true
    )
  }

  function onRotos(ordenItemId: string, valor: number | null) {
    cambiarFilas(
      renglonesRef.current.map((fila) =>
        fila.orden_item_id === ordenItemId ? { ...fila, rotos: valor } : fila
      ),
      true
    )
  }

  function onNota(ordenItemId: string, nota: string) {
    cambiarFilas(
      renglonesRef.current.map((fila) =>
        fila.orden_item_id === ordenItemId ? { ...fila, nota } : fila
      ),
      true
    )
  }

  async function onFoto(ordenItemId: string, file: File) {
    const foto = await archivoAFotoFile(file)
    const siguientes = { ...fotosRef.current, [ordenItemId]: file }
    fotosRef.current = siguientes
    setFotos(siguientes)
    cambiarFilas(
      renglonesRef.current.map((fila) =>
        fila.orden_item_id === ordenItemId ? { ...fila, foto } : fila
      )
    )
    setAviso(null)
  }

  function quitarFoto(ordenItemId: string) {
    const siguientes = { ...fotosRef.current }
    delete siguientes[ordenItemId]
    fotosRef.current = siguientes
    setFotos(siguientes)
    cambiarFilas(
      renglonesRef.current.map((fila) =>
        fila.orden_item_id === ordenItemId ? { ...fila, foto: null } : fila
      )
    )
  }

  async function onTalon(file: File) {
    const foto = await archivoAFotoFile(file)
    talonFoto.current = foto
    talonRef.current = file
    setTalon(file)
    persistir(armarBorrador(pasoRef.current, renglonesRef.current, quienRef.current))
    setAviso(null)
  }

  function quitarTalon() {
    talonFoto.current = null
    talonRef.current = null
    setTalon(null)
    persistir(armarBorrador(pasoRef.current, renglonesRef.current, quienRef.current))
  }

  async function agregarExtra(file: File) {
    const foto = await archivoAFotoFile(file)
    extrasFoto.current = [...extrasFoto.current, foto]
    const siguientes = [...extrasRef.current, file]
    extrasRef.current = siguientes
    setExtras(siguientes)
    persistir(armarBorrador(pasoRef.current, renglonesRef.current, quienRef.current))
  }

  function quitarExtra(indice: number) {
    extrasFoto.current = extrasFoto.current.filter((_, i) => i !== indice)
    const siguientes = extrasRef.current.filter((_, i) => i !== indice)
    extrasRef.current = siguientes
    setExtras(siguientes)
    persistir(armarBorrador(pasoRef.current, renglonesRef.current, quienRef.current))
  }

  function onQuien(valor: string) {
    quienRef.current = valor
    setQuien(valor)
    persistirDiferido()
  }

  function irA(siguiente: PasoChecklist) {
    pasoRef.current = siguiente
    setPaso(siguiente)
    persistir(armarBorrador(siguiente, renglonesRef.current, quienRef.current))
  }

  function onAtras() {
    if (pasoRef.current === 2 && vistaRef.current === 'detalle') {
      colocar(indiceRef.current, 'marca')
      setAviso(null)
      return
    }
    if (pasoRef.current === 2 && vistaRef.current === 'marca') {
      volverALista()
      setAviso(null)
      return
    }
    if (pasoRef.current === 2) {
      router.push('/recepciones')
      return
    }
    if (pasoRef.current === 3) colocar(0, 'lista')
    irA(pasoRef.current === 4 ? 3 : 2)
  }

  function onSiguiente() {
    if (pasoRef.current === 2 && vistaRef.current === 'lista') {
      const filas = renglonesRef.current.map(aRenglonChecklist)
      const bloqueo = motivoMateriales(materiales, filas)
      if (bloqueo) {
        setAviso(bloqueo)
        return
      }
      setAviso(null)
      irA(3)
      return
    }
    if (pasoRef.current === 2) {
      const material = materiales[indiceRef.current]
      const fila = renglonesRef.current.find((row) => row.orden_item_id === material?.orden_item_id)
      if (!material || !fila) {
        setAviso(MENSAJE_FALTA_REVISAR)
        return
      }
      const error = errorDeRenglon(material, aRenglonChecklist(fila))
      if (error) {
        setAviso(error)
        return
      }
      setAviso(null)
      volverALista()
      return
    }
    if (!talonRef.current) {
      setAviso(MENSAJE_FALTA_TALON)
      return
    }
    setAviso(null)
    irA(4)
  }

  function enviar() {
    const filasBorrador = renglonesRef.current
    const filas = filasBorrador.map(aRenglonChecklist)
    const bloqueo = motivoBloqueo(materiales, filas, talonFoto.current !== null)
    if (bloqueo) {
      setAviso(bloqueo)
      return
    }
    const itemsListos = []
    for (const material of materiales) {
      const fila = filasBorrador.find((row) => row.orden_item_id === material.orden_item_id)
      if (!fila) {
        setAviso(MENSAJE_FALTA_REVISAR)
        return
      }
      const armado = itemDesdeRenglon(material, aRenglonChecklist(fila))
      if (!armado.ok) {
        setAviso(armado.error)
        return
      }
      itemsListos.push(armado.item)
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      pendienteEnvio.current = true
      persistir(armarBorrador(pasoRef.current, filasBorrador, quienRef.current))
      setAviso(MENSAJE_SIN_SENAL)
      return
    }
    const fd = new FormData()
    fd.set('origen_checklist', '1')
    fd.set('id', recepcionId.current)
    fd.set('orden_id', ordenId)
    fd.set('referencia_entrega', quienRef.current)
    fd.set('nota', '')
    fd.set('recibido_en', new Date().toISOString())
    fd.set('items_json', JSON.stringify(itemsListos))
    const fotoTalon = talonRef.current
    if (fotoTalon) fd.set('foto_remision', fotoTalon)
    for (const fila of filasBorrador) {
      const foto = fotosRef.current[fila.orden_item_id]
      if (foto) fd.set(`foto_item_${fila.orden_item_id}`, foto)
    }
    for (const extra of extrasRef.current) fd.append('foto_extra', extra)
    respaldo.current = {
      ...armarBorrador(pasoRef.current, filasBorrador, quienRef.current),
      pendienteEnvio: true,
    }
    pendienteEnvio.current = false
    cancelarGuardadoDiferido()
    borrarBorrador(almacenNavegador(), ordenId)
    enviando.current = true
    formAction(fd)
  }

  const enviarRef = useRef(enviar)
  enviarRef.current = enviar

  useEffect(() => {
    if (!cargado) return
    function intentar() {
      if (!pendienteEnvio.current || enviando.current) return
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return
      enviarRef.current()
    }
    window.addEventListener('online', intentar)
    return () => window.removeEventListener('online', intentar)
  }, [cargado])

  if (materiales.length === 0) {
    return (
      <p className="text-base text-foreground">Este pedido ya no tiene material por recibir.</p>
    )
  }

  if (!cargado) {
    return <p className="text-base text-foreground">Cargando tu avance…</p>
  }

  const vista: MaterialVista[] = materiales.map((material) => {
    const fila = renglones.find((row) => row.orden_item_id === material.orden_item_id)
    return {
      ...material,
      marca: fila?.marca ?? null,
      bien: fila?.bien ?? null,
      rotos: fila?.rotos ?? null,
      nota: fila?.nota ?? '',
      tieneFoto: Boolean(fila?.foto),
    }
  })

  return (
    <ChecklistRecepcionPasos
      paso={paso}
      indice={indice}
      vistaMaterial={vistaMaterial}
      folio={folio}
      obraNombre={obraNombre}
      materiales={vista}
      tieneTalon={talon !== null}
      quienEntrego={quien}
      aviso={aviso}
      onAtras={onAtras}
      onSiguiente={onSiguiente}
      onIrAMaterial={(donde) => {
        colocar(donde, 'marca')
        setAviso(null)
      }}
      hayDeshacer={antesDeTodo !== null}
      onAlternar={onAlternar}
      onTodoLlego={onTodoLlego}
      onDeshacer={onDeshacer}
      onMarca={onMarca}
      onBien={onBien}
      onRotos={onRotos}
      onNota={onNota}
      onQuien={onQuien}
      onTerminar={enviar}
      zonaTalon={
        <AdjuntarArchivo
          archivo={talon}
          onArchivo={(file) => {
            void onTalon(file)
          }}
          onError={setAviso}
          onQuitar={quitarTalon}
          validar={validarFotoRecepcion}
          tituloZona="Toca aquí para elegir archivo"
          ayudaZona="O presiona Ctrl + V"
          nota={null}
          tituloCamara="Foto del talón"
          ariaLabel="Elegir foto del talón"
          accept="image/*"
          botonArchivo="Elegir archivo"
          grande
        />
      }
      fotosExtra={
        talon === null ? null : (
        <div className="flex w-full flex-col gap-3">
          {extras.map((file, indice) => (
            <div key={`${file.name}-${file.size}-${indice}`} className="flex w-full flex-col gap-2">
              <p className="text-base text-foreground">{file.name}</p>
              <button
                type="button"
                onClick={() => quitarExtra(indice)}
                className={`${CLASE_BOTON_GRANDE} border border-border bg-card text-foreground`}
              >
                Quitar
              </button>
            </div>
          ))}
          <SelectorFoto
            titulo="Agregar otra foto"
            archivo={null}
            onArchivo={(file) => {
              void agregarExtra(file)
            }}
            onError={setAviso}
          />
        </div>
        )
      }
      zonaFotoRenglon={(ordenItemId) => (
        <SelectorFoto
          titulo="Foto de lo que llegó mal"
          archivo={fotos[ordenItemId] ?? null}
          onArchivo={(file) => {
            void onFoto(ordenItemId, file)
          }}
          onQuitar={() => quitarFoto(ordenItemId)}
          onError={setAviso}
        />
      )}
    />
  )
}
