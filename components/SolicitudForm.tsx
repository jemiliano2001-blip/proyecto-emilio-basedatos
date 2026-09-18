'use client'

import { useActionState, useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { useOfflineUser } from '@/components/OfflineUserProvider'
import { useRouter } from 'next/navigation'
import type { ActionResult } from '@/lib/actions/solicitudes'
import { FormError } from '@/components/FormError'
import { MaterialSearchCombobox } from '@/components/MaterialSearchCombobox'
import { SubmitButton } from '@/components/SubmitButton'
import { putSolicitudPendiente } from '@/lib/offline/db'
import { parseMoney, parseQuantity } from '@/lib/money'
import type { TipoLineaSolicitud } from '@/lib/types'
import { IconPlus, IconAlerta, IconOjo } from '@/components/icons'
import { SolicitudPreviewModal, type PreviewItemData } from '@/components/SolicitudPreviewModal'

const initialState: ActionResult = { error: null }

interface ObraOption {
  id: string
  nombre: string
  fraccionamiento: string | null
}

interface MaterialOption {
  id: string
  nombre_base: string
  variante: string | null
  unidad_medida: string
  categoria?: string | null
  subcategoria?: string | null
  precio_base?: number
}

interface SaldoItemOption {
  obra_id: string
  material_id: string
  cantidad_disponible: number
  cantidad_comprometida?: number
}

interface ItemRow {
  key: string
  tipo_linea: TipoLineaSolicitud
  material_id: string
  cantidad: string
  descripcion: string
  monto_mxn: string
  nota: string
  obra_id: string
}

function nuevaFila(tipo_linea: TipoLineaSolicitud = 'material'): ItemRow {
  return {
    key: crypto.randomUUID(),
    tipo_linea,
    material_id: '',
    cantidad: '',
    descripcion: '',
    monto_mxn: '',
    nota: '',
    obra_id: '',
  }
}

export function SolicitudForm({
  action,
  obras,
  materiales,
  saldos = [],
  defaultObraId,
  permiteMultiObra = false,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>
  obras: ObraOption[]
  materiales: MaterialOption[]
  saldos?: SaldoItemOption[]
  defaultObraId?: string
  permiteMultiObra?: boolean
}) {
  const router = useRouter()
  const userId = useOfflineUser()
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction] = useActionState(action, initialState)
  const [selectedObraId, setSelectedObraId] = useState<string>(defaultObraId ?? (obras[0]?.id ?? ''))
  const [items, setItems] = useState<ItemRow[]>([nuevaFila()])
  const [multiObra, setMultiObra] = useState(false)
  const [notaGeneral, setNotaGeneral] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [offlineMsg, setOfflineMsg] = useState<string | null>(null)
  const [offlineError, setOfflineError] = useState<string | null>(null)
  const [clientValidationError, setClientValidationError] = useState<string | null>(null)
  const [guardandoOffline, setGuardandoOffline] = useState(false)
  const [lastRemoved, setLastRemoved] = useState<{ item: ItemRow; index: number } | null>(null)
  const undoTimer = useRef<number | null>(null)
  const [draftReady, setDraftReady] = useState(false)
  const [draftRecovered, setDraftRecovered] = useState(false)
  const draftKey = `obra_track_solicitud_draft_${userId ?? 'anon'}`

  useEffect(() => {
    if (!userId) {
      setDraftReady(true)
      return
    }
    try {
      const raw = window.localStorage.getItem(draftKey)
      if (raw) {
        const draft = JSON.parse(raw) as {
          selectedObraId?: string
          items?: ItemRow[]
          multiObra?: boolean
          notaGeneral?: string
        }
        if (draft.selectedObraId && obras.some((obra) => obra.id === draft.selectedObraId)) setSelectedObraId(draft.selectedObraId)
        if (Array.isArray(draft.items) && draft.items.length > 0) {
          const validItems = draft.items.filter((item) => item && typeof item.key === 'string').map((item) => ({
            ...item,
            tipo_linea: ['material', 'flete', 'camiones', 'mantenimiento', 'otro'].includes(item.tipo_linea)
              ? item.tipo_linea
              : 'material',
            material_id: materiales.some((material) => material.id === item.material_id) ? item.material_id : '',
            descripcion: typeof item.descripcion === 'string' ? item.descripcion : '',
            monto_mxn: typeof item.monto_mxn === 'string' ? item.monto_mxn : '',
            obra_id: obras.some((obra) => obra.id === item.obra_id) ? item.obra_id : '',
          }))
          if (validItems.length > 0) setItems(validItems)
        }
        setMultiObra(Boolean(draft.multiObra && permiteMultiObra))
        setNotaGeneral(typeof draft.notaGeneral === 'string' ? draft.notaGeneral : '')
        setDraftRecovered(true)
      }
    } catch {
      window.localStorage.removeItem(draftKey)
    }
    setDraftReady(true)
  }, [draftKey, materiales, obras, permiteMultiObra, userId])

  useEffect(() => {
    if (!draftReady || !userId) return
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(draftKey, JSON.stringify({ selectedObraId, items, multiObra, notaGeneral }))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [draftKey, draftReady, items, multiObra, notaGeneral, selectedObraId, userId])

  useEffect(() => () => {
    if (undoTimer.current) window.clearTimeout(undoTimer.current)
  }, [])

  function clearDraft() {
    window.localStorage.removeItem(draftKey)
    setDraftRecovered(false)
  }

  // Mapas de ayuda
  const materialMap = useMemo(() => {
    return new Map(materiales.map((m) => [m.id, m]))
  }, [materiales])

  const saldoMap = useMemo(() => {
    const map = new Map<string, { disponible: number; comprometido: number }>()
    for (const s of saldos) {
      map.set(`${s.obra_id}_${s.material_id}`, {
        disponible: s.cantidad_disponible,
        comprometido: s.cantidad_comprometida ?? 0,
      })
    }
    return map
  }, [saldos])

  const getSaldoInfo = useCallback(
    (obraId: string, materialId: string): { disponible: number | null; comprometido: number | null } => {
      if (!obraId || !materialId) return { disponible: null, comprometido: null }
      const key = `${obraId}_${materialId}`
      if (saldoMap.has(key)) {
        const item = saldoMap.get(key)!
        return { disponible: item.disponible, comprometido: item.comprometido }
      }
      // Si la obra tiene datos de saldos cargados y este material no está en la tabla, su asignación es 0
      if (saldos.length > 0) {
        return { disponible: 0, comprometido: 0 }
      }
      return { disponible: null, comprometido: null }
    },
    [saldoMap, saldos.length]
  )

  const obraNombrePrincipal = useMemo(() => {
    return obras.find((o) => o.id === selectedObraId)?.nombre ?? 'Proyecto'
  }, [obras, selectedObraId])

  const previewItems = useMemo<PreviewItemData[]>(() => {
    return items.map((item) => {
      const mat = materialMap.get(item.material_id)
      const effectiveObraId = multiObra ? item.obra_id : selectedObraId
      const info = getSaldoInfo(effectiveObraId, item.material_id)
      const cant = parseQuantity(item.cantidad) ?? 0
      const obra = obras.find((o) => o.id === effectiveObraId)

      return {
        tipo_linea: item.tipo_linea,
        nombre: item.tipo_linea === 'material'
          ? (mat ? `${mat.nombre_base}${mat.variante ? ` · ${mat.variante}` : ''}` : 'Material no seleccionado')
          : (item.descripcion || 'Servicio sin descripción'),
        variante: mat?.variante,
        cantidad: cant,
        unidad_medida: mat?.unidad_medida ?? 'PZA',
        monto_mxn: item.tipo_linea === 'material' ? null : (parseMoney(item.monto_mxn) ?? null),
        nota: item.nota || null,
        obraNombre: multiObra ? obra?.nombre : null,
        disponible: info.disponible,
      }
    })
  }, [items, materialMap, multiObra, selectedObraId, obras, getSaldoInfo])

  const itemsJson = useMemo(
    () =>
      JSON.stringify(
        items.map((item) => ({
          tipo_linea: item.tipo_linea,
          material_id: item.tipo_linea === 'material' ? (item.material_id || null) : null,
          cantidad_solicitada: item.tipo_linea === 'material' ? (item.cantidad || null) : null,
          descripcion: item.tipo_linea === 'material' ? null : (item.descripcion || null),
          monto_mxn: item.tipo_linea === 'material' ? null : (item.monto_mxn || null),
          nota: item.nota || null,
          obra_id: multiObra && item.obra_id !== '' ? item.obra_id : null,
        }))
      ),
    [items, multiObra]
  )

  function actualizarFila(key: string, cambios: Partial<ItemRow>) {
    setClientValidationError(null)
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...cambios } : item)))
  }

  function agregarFila(tipo: TipoLineaSolicitud = 'material') {
    setItems((prev) => [...prev, nuevaFila(tipo)])
  }

  function quitarFila(key: string) {
    if (items.length <= 1) return
    const index = items.findIndex((item) => item.key === key)
    if (index < 0) return
    setLastRemoved({ item: items[index], index })
    setItems((prev) => prev.filter((item) => item.key !== key))
    if (undoTimer.current) window.clearTimeout(undoTimer.current)
    undoTimer.current = window.setTimeout(() => setLastRemoved(null), 5000)
  }

  function undoRemove() {
    if (!lastRemoved) return
    setItems((current) => {
      const next = [...current]
      next.splice(Math.min(lastRemoved.index, next.length), 0, lastRemoved.item)
      return next
    })
    setLastRemoved(null)
    if (undoTimer.current) window.clearTimeout(undoTimer.current)
  }

  function materialesDisponiblesPara(key: string, obraId: string) {
    const usados = new Set(
      items
        .filter((i) => i.key !== key && i.material_id)
        .filter((i) => !multiObra || i.obra_id === obraId)
        .map((i) => i.material_id)
    )
    const effectiveObraId = multiObra ? obraId : selectedObraId
    return materiales
      .filter((m) => !usados.has(m.id))
      .map((m) => {
        const info = getSaldoInfo(effectiveObraId, m.id)
        return {
          ...m,
          disponible: info.disponible,
          comprometido: info.comprometido,
        }
      })
      // Listar únicamente materiales que cuenten con saldo disponible en la obra (> 0)
      .filter((m) => m.disponible !== null && m.disponible > 0)
  }

  function validarSaldos(): string | null {
    for (const item of items) {
      if (item.tipo_linea !== 'material') continue
      if (!item.material_id) {
        return 'Selecciona el material en cada partida.'
      }
      const effectiveObraId = multiObra ? item.obra_id : selectedObraId
      if (!effectiveObraId) {
        return 'Selecciona el proyecto para la requisición.'
      }

      const info = getSaldoInfo(effectiveObraId, item.material_id)
      const mat = materialMap.get(item.material_id)
      const matNombre = mat ? `${mat.nombre_base}${mat.variante ? ` · ${mat.variante}` : ''}` : 'el material'

      if (info.disponible !== null) {
        if (info.disponible <= 0) {
          return `Saldo insuficiente: El material "${matNombre}" no tiene saldo disponible en este proyecto (Disponible: 0).`
        }
        const cantNum = parseQuantity(item.cantidad)
        if (cantNum === null || cantNum <= 0) {
          return `Indica una cantidad válida mayor a cero para "${matNombre}".`
        }
        if (cantNum > info.disponible) {
          return `Cantidad excesiva: Para "${matNombre}", solicitas ${cantNum} pero solo hay ${info.disponible} disponible.`
        }
      }
    }
    return null
  }

  async function guardarOffline(formData: FormData) {
    if (!userId) { setOfflineError("Inicia sesión para guardar en este teléfono."); return }
    setOfflineError(null)
    setOfflineMsg(null)
    setClientValidationError(null)
    setGuardandoOffline(true)

    try {
      if (multiObra) {
        setOfflineError('Las requisiciones de varios proyectos necesitan conexión — no se pueden guardar sin internet.')
        return
      }

      const obra_id = String(formData.get('obra_id') ?? selectedObraId)
      const notaRaw = formData.get('nota')
      const nota =
        typeof notaRaw === 'string' && notaRaw.trim() !== '' ? notaRaw.trim() : null

      if (!obra_id) {
        setOfflineError('Selecciona un proyecto.')
        return
      }

      // Validar saldos
      const errorSaldo = validarSaldos()
      if (errorSaldo) {
        setOfflineError(errorSaldo)
        return
      }

      const parsedItems: {
        tipo_linea: TipoLineaSolicitud
        material_id: string | null
        cantidad_solicitada: number | null
        descripcion: string | null
        monto_mxn: number | null
        nota: string | null
      }[] = []

      for (const item of items) {
        if (item.tipo_linea === 'material') {
          if (!item.material_id) {
            setOfflineError('Selecciona el material en cada partida.')
            return
          }
          const cantidad = parseQuantity(item.cantidad)
          if (cantidad === null || cantidad <= 0) {
            setOfflineError('Revisa las cantidades: deben ser mayores a cero.')
            return
          }
          parsedItems.push({
            tipo_linea: 'material', material_id: item.material_id, cantidad_solicitada: cantidad,
            descripcion: null, monto_mxn: null, nota: item.nota.trim() === '' ? null : item.nota.trim(),
          })
        } else {
          const monto = parseMoney(item.monto_mxn)
          if (!item.descripcion.trim() || monto === null || monto <= 0) {
            setOfflineError('Cada servicio requiere descripción y monto mayor a cero.')
            return
          }
          parsedItems.push({
            tipo_linea: item.tipo_linea, material_id: null, cantidad_solicitada: null,
            descripcion: item.descripcion.trim(), monto_mxn: monto, nota: item.nota.trim() === '' ? null : item.nota.trim(),
          })
        }
      }

      const now = new Date().toISOString()
      const id = crypto.randomUUID()
      await putSolicitudPendiente({
        usuario_id: userId,
        id,
        obra_id,
        nota,
        items: parsedItems,
        status: 'guardado_local',
        error: null,
        created_at: now,
        updated_at: now,
      })

      setOfflineMsg('Guardado en este teléfono. Se enviará cuando haya conexión.')
      clearDraft()
      router.push('/solicitudes')
    } catch {
      setOfflineError('No se pudo guardar en este teléfono. Intenta de nuevo.')
    } finally {
      setGuardandoOffline(false)
    }
  }

  function handleSubmit(formData: FormData) {
    setClientValidationError(null)
    const saldoErr = validarSaldos()
    if (saldoErr) {
      setClientValidationError(saldoErr)
      return
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      void guardarOffline(formData)
      return
    }
    clearDraft()
    formAction(formData)
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
          e.preventDefault()
        }
      }}
      className="space-y-5"
    >
      <input type="hidden" name="items_json" value={itemsJson} />
      <FormError message={state.error ?? offlineError ?? clientValidationError} />
      {draftRecovered && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900" role="status">
          <span>Recuperamos el borrador guardado en este dispositivo.</span>
          <button type="button" className="min-h-[44px] px-3 font-semibold text-teal-900 underline" onClick={clearDraft}>Descartar borrador</button>
        </div>
      )}
      {lastRemoved && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm" role="status">
          <span>Partida eliminada.</span>
          <button type="button" className="min-h-[44px] px-3 font-semibold text-accent underline" onClick={undoRemove}>Deshacer</button>
        </div>
      )}
      {offlineMsg && (
        <p className="rounded-lg bg-teal-50 text-teal-800 text-sm px-3 py-2">{offlineMsg}</p>
      )}

      {permiteMultiObra && (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={multiObra}
            onChange={(e) => setMultiObra(e.target.checked)}
          />
          Requisición a varios proyectos (cada material elige el suyo)
        </label>
      )}

      {multiObra ? (
        <input type="hidden" name="obra_id" value={items[0]?.obra_id ?? ''} />
      ) : (
        <div>
          <label htmlFor="obra_id" className="block text-sm font-medium text-gray-700 mb-1">
            Proyecto *
          </label>
          <select
            id="obra_id"
            name="obra_id"
            required
            value={selectedObraId}
            onChange={(e) => setSelectedObraId(e.target.value)}
            className="input-base"
          >
            <option value="" disabled>
              Selecciona un proyecto
            </option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
                {o.fraccionamiento ? ` · ${o.fraccionamiento}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-3">
        <label className="block text-sm font-semibold text-ink">
          Renglones de la requisición
        </label>

        <div className="card space-y-0 divide-y divide-gray-100 p-0 overflow-hidden">
          {items.map((item, idx) => {
            const effectiveObraId = multiObra ? item.obra_id : selectedObraId
            const info = item.material_id ? getSaldoInfo(effectiveObraId, item.material_id) : { disponible: null, comprometido: null }
            const disp = info.disponible
            const cantNum = parseQuantity(item.cantidad)
            const sinSaldo = disp !== null && disp <= 0
            const saldoInsuficiente =
              disp !== null && disp > 0 && cantNum !== null && cantNum > disp
            const selectedMat = materialMap.get(item.material_id)

            return (
              <div
                key={item.key}
                className={`relative space-y-3 p-4 transition-colors ${
                  sinSaldo || saldoInsuficiente ? 'bg-red-50/40' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500 font-mono">
                    {item.tipo_linea === 'material' ? 'Material' : item.tipo_linea} #{idx + 1}
                  </span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => quitarFila(item.key)}
                      className="text-xs text-red-600 hover:text-red-700 font-medium py-1 px-2 -mr-2 rounded hover:bg-red-50 transition-colors"
                    >
                      Quitar
                    </button>
                  )}
                </div>

                {multiObra && item.tipo_linea === 'material' && (
                  <select
                    value={item.obra_id}
                    onChange={(e) =>
                      actualizarFila(item.key, {
                        obra_id: e.target.value,
                        material_id: '',
                      })
                    }
                    className="input-base text-sm"
                    required
                  >
                    <option value="" disabled>
                      Selecciona el proyecto de este material...
                    </option>
                    {obras.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nombre}
                      </option>
                    ))}
                  </select>
                )}

                {item.tipo_linea === 'material' ? <>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                    Material *
                  </label>
                  <MaterialSearchCombobox
                    materials={materialesDisponiblesPara(item.key, item.obra_id)}
                    value={item.material_id}
                    onChange={(material_id) =>
                      actualizarFila(item.key, { material_id })
                    }
                  />
                  {sinSaldo && (
                    <p className="text-xs font-semibold text-red-600 mt-1.5 flex items-center gap-1.5">
                      <IconAlerta className="w-3.5 h-3.5 shrink-0" />
                      <span>Este material no tiene presupuesto asignado o se encuentra agotado en el proyecto.</span>
                    </p>
                  )}
                  {saldoInsuficiente && (
                    <p className="text-xs font-semibold text-red-600 mt-1.5 flex items-center gap-1.5">
                      <IconAlerta className="w-3.5 h-3.5 shrink-0" />
                      <span>La cantidad solicitada ({cantNum}) supera el saldo disponible ({disp}). Ajusta la cantidad.</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    Cantidad solicitada {selectedMat ? `(${selectedMat.unidad_medida})` : ''} *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      placeholder="0"
                      value={item.cantidad}
                      onChange={(e) =>
                        actualizarFila(item.key, { cantidad: e.target.value })
                      }
                      className="input-base pr-12"
                    />
                    {selectedMat && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground pointer-events-none">
                        {selectedMat.unidad_medida}
                      </span>
                    )}
                  </div>
                  {item.cantidad.trim() !== '' && (cantNum === null || cantNum <= 0) && (
                    <p className="text-xs font-semibold text-danger mt-1 flex items-center gap-1">
                      <IconAlerta className="w-3 h-3 shrink-0" />
                      <span>Ingresa una cantidad mayor a cero.</span>
                    </p>
                  )}
                </div>

                <input
                  type="text"
                  placeholder="Nota (opcional)"
                  value={item.nota}
                  onChange={(e) => actualizarFila(item.key, { nota: e.target.value })}
                  className="input-base text-sm"
                />
                </> : <>
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Descripción *</label>
                    <input
                      type="text"
                      required
                      value={item.descripcion}
                      onChange={(e) => actualizarFila(item.key, { descripcion: e.target.value })}
                      className="input-base text-sm"
                      placeholder="Describe el servicio o gasto"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Monto MXN *</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={item.monto_mxn}
                      onChange={(e) => actualizarFila(item.key, { monto_mxn: e.target.value })}
                      className="input-base text-sm"
                      placeholder="0.00"
                    />
                    {item.monto_mxn.trim() !== '' && (parseMoney(item.monto_mxn) === null || (parseMoney(item.monto_mxn) ?? 0) <= 0) && (
                      <p className="text-xs font-semibold text-danger mt-1 flex items-center gap-1">
                        <IconAlerta className="w-3 h-3 shrink-0" />
                        <span>El monto debe ser mayor a cero.</span>
                      </p>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Nota (opcional)"
                    value={item.nota}
                    onChange={(e) => actualizarFila(item.key, { nota: e.target.value })}
                    className="input-base text-sm"
                  />
                </>}
              </div>
            )
          })}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => agregarFila('material')} className="rounded-xl border border-dashed border-rule py-3 text-sm font-semibold text-accent hover:bg-teal-50/50 inline-flex items-center justify-center gap-1.5">
            <IconPlus className="w-4 h-4" /><span>Agregar material</span>
          </button>
          <label className="rounded-xl border border-dashed border-rule px-3 py-2 text-sm font-semibold text-accent hover:bg-teal-50/50 inline-flex items-center justify-center gap-1.5">
            <span className="sr-only">Agregar servicio o gasto</span>
            <IconPlus className="w-4 h-4" />
            <select className="bg-transparent text-sm outline-none" defaultValue="" onChange={(event) => {
              const tipo = event.target.value as TipoLineaSolicitud
              if (tipo) { agregarFila(tipo); event.target.value = '' }
            }}>
              <option value="" disabled>Agregar flete, camiones, mantenimiento u otro</option>
              <option value="flete">Flete</option>
              <option value="camiones">Camiones</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="otro">Otro</option>
            </select>
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="nota" className="block text-sm font-medium text-gray-700 mb-1">
          Nota general (opcional)
        </label>
        <textarea
          id="nota"
          name="nota"
          rows={3}
          value={notaGeneral}
          onChange={(e) => setNotaGeneral(e.target.value)}
          className="input-base"
          placeholder="Nota"
        />
      </div>

      {/* Botones de acción principales reubicados al final de la página */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2.5 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={() => {
            setClientValidationError(null)
            setShowPreview(true)
          }}
          className="btn-secondary text-sm py-2.5 px-4 inline-flex items-center justify-center gap-2"
        >
          <IconOjo className="w-4 h-4 text-teal-800" />
          <span>Vista previa</span>
        </button>
        <div className="flex-1">
          <SubmitButton>
            {guardandoOffline ? 'Guardando en el teléfono…' : 'Enviar requisición'}
          </SubmitButton>
        </div>
      </div>
      <p className="text-xs text-gray-500 text-center">
        Sin señal: se guarda en este teléfono y se envía al recuperar conexión.
      </p>

      {/* Modal de Vista Previa de la Requisición */}
      <SolicitudPreviewModal
        open={showPreview}
        onClose={() => setShowPreview(false)}
        onConfirm={() => {
          setShowPreview(false)
          if (formRef.current) {
            formRef.current.requestSubmit()
          }
        }}
        obraNombrePrincipal={obraNombrePrincipal}
        notaGeneral={notaGeneral}
        items={previewItems}
      />
    </form>
  )
}
