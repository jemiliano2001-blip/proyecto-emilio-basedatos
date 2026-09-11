'use client'

import { useMemo, useState, useRef, useCallback } from 'react'
import { useFormState } from 'react-dom'
import { useOfflineUser } from '@/components/OfflineUserProvider'
import { useRouter } from 'next/navigation'
import type { ActionResult } from '@/lib/actions/solicitudes'
import { FormError } from '@/components/FormError'
import { MaterialSearchCombobox } from '@/components/MaterialSearchCombobox'
import { SubmitButton } from '@/components/SubmitButton'
import { putSolicitudPendiente } from '@/lib/offline/db'
import { parseQuantity } from '@/lib/money'
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
  material_id: string
  cantidad: string
  nota: string
  obra_id: string
}

function nuevaFila(): ItemRow {
  return {
    key: crypto.randomUUID(),
    material_id: '',
    cantidad: '',
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
  const [state, formAction] = useFormState(action, initialState)
  const [selectedObraId, setSelectedObraId] = useState<string>(defaultObraId ?? (obras[0]?.id ?? ''))
  const [items, setItems] = useState<ItemRow[]>([nuevaFila()])
  const [multiObra, setMultiObra] = useState(false)
  const [notaGeneral, setNotaGeneral] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [offlineMsg, setOfflineMsg] = useState<string | null>(null)
  const [offlineError, setOfflineError] = useState<string | null>(null)
  const [clientValidationError, setClientValidationError] = useState<string | null>(null)
  const [guardandoOffline, setGuardandoOffline] = useState(false)

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
        tipo_linea: 'material',
        nombre: mat ? `${mat.nombre_base}${mat.variante ? ` · ${mat.variante}` : ''}` : 'Material no seleccionado',
        variante: mat?.variante,
        cantidad: cant,
        unidad_medida: mat?.unidad_medida ?? 'PZA',
        monto_mxn: null,
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
          tipo_linea: 'material',
          material_id: item.material_id || null,
          cantidad_solicitada: item.cantidad || null,
          descripcion: null,
          monto_mxn: null,
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

  function agregarFila() {
    setItems((prev) => [...prev, nuevaFila()])
  }

  function quitarFila(key: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((item) => item.key !== key) : prev))
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
      if (!item.material_id) {
        return 'Selecciona un material en todos los renglones.'
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
        if (!item.material_id) {
          setOfflineError('Selecciona un material en todos los renglones.')
          return
        }
        const cantidad = parseQuantity(item.cantidad)
        if (cantidad === null || cantidad <= 0) {
          setOfflineError('Revisa las cantidades: deben ser mayores a cero.')
          return
        }
        parsedItems.push({
          tipo_linea: 'material',
          material_id: item.material_id,
          cantidad_solicitada: cantidad,
          descripcion: null,
          monto_mxn: null,
          nota: item.nota.trim() === '' ? null : item.nota.trim(),
        })
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
          Requisición a varios proyectos (cada renglón elige el suyo)
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
          Partidas de materiales
        </label>

        <div className="space-y-4">
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
                className={`card relative space-y-3 transition-colors ${
                  sinSaldo || saldoInsuficiente ? 'border-red-300 bg-red-50/20' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500 font-mono">
                    Partida #{idx + 1}
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

                {multiObra && (
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
                      Selecciona el proyecto de este renglón...
                    </option>
                    {obras.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nombre}
                      </option>
                    ))}
                  </select>
                )}

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
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">
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
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 pointer-events-none">
                        {selectedMat.unidad_medida}
                      </span>
                    )}
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="Nota del renglón (opcional)"
                  value={item.nota}
                  onChange={(e) => actualizarFila(item.key, { nota: e.target.value })}
                  className="input-base text-sm"
                />
              </div>
            )
          })}
        </div>

        <button
          type="button"
          onClick={agregarFila}
          className="mt-3 w-full rounded-xl border border-dashed border-rule py-3 text-sm font-semibold text-accent hover:bg-teal-50/50 inline-flex items-center justify-center gap-1.5 transition-colors"
        >
          <IconPlus className="w-4 h-4" />
          <span>Agregar otro material</span>
        </button>
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
