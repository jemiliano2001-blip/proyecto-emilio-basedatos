'use client'

import { useMemo, useState } from 'react'
import { useFormState } from 'react-dom'
import { useRouter } from 'next/navigation'
import type { ActionResult } from '@/lib/actions/solicitudes'
import { FormError } from '@/components/FormError'
import { MaterialSearchCombobox } from '@/components/MaterialSearchCombobox'
import { SubmitButton } from '@/components/SubmitButton'
import { putSolicitudPendiente } from '@/lib/offline/db'
import { parseMoney, parseQuantity } from '@/lib/money'
import {
  TIPOS_LINEA_SOLICITUD,
  labelTipoLinea,
} from '@/lib/validations/solicitud'
import type { TipoLineaSolicitud } from '@/lib/types'

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

function nuevaFila(): ItemRow {
  return {
    key: crypto.randomUUID(),
    tipo_linea: 'material',
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
  const [state, formAction] = useFormState(action, initialState)
  const [selectedObraId, setSelectedObraId] = useState<string>(defaultObraId ?? (obras[0]?.id ?? ''))
  const [items, setItems] = useState<ItemRow[]>([nuevaFila()])
  const [multiObra, setMultiObra] = useState(false)
  const [offlineMsg, setOfflineMsg] = useState<string | null>(null)
  const [offlineError, setOfflineError] = useState<string | null>(null)
  const [clientValidationError, setClientValidationError] = useState<string | null>(null)
  const [guardandoOffline, setGuardandoOffline] = useState(false)

  // Mapas de ayuda
  const materialMap = useMemo(() => {
    return new Map(materiales.map((m) => [m.id, m]))
  }, [materiales])

  const saldoMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of saldos) {
      map.set(`${s.obra_id}_${s.material_id}`, s.cantidad_disponible)
    }
    return map
  }, [saldos])

  function getSaldoDisponible(obraId: string, materialId: string): number | null {
    if (!obraId || !materialId) return null
    const key = `${obraId}_${materialId}`
    if (saldoMap.has(key)) {
      return saldoMap.get(key)!
    }
    // Si la obra tiene datos de saldos cargados y este material no está en la tabla, su asignación es 0
    if (saldos.length > 0) {
      return 0
    }
    return null
  }

  const itemsJson = useMemo(
    () =>
      JSON.stringify(
        items.map((item) => ({
          tipo_linea: item.tipo_linea,
          material_id: item.tipo_linea === 'material' ? item.material_id : null,
          cantidad_solicitada: item.tipo_linea === 'material' ? item.cantidad : null,
          descripcion: item.tipo_linea === 'material' ? null : item.descripcion,
          monto_mxn: item.monto_mxn.trim() === '' ? null : item.monto_mxn,
          nota: item.nota,
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
        .filter((i) => i.key !== key && i.tipo_linea === 'material' && i.material_id)
        .filter((i) => !multiObra || i.obra_id === obraId)
        .map((i) => i.material_id)
    )
    return materiales.filter((m) => !usados.has(m.id))
  }

  function validarSaldos(): string | null {
    for (const item of items) {
      if (item.tipo_linea === 'material') {
        if (!item.material_id) {
          return 'Selecciona un material en todos los renglones.'
        }
        const effectiveObraId = multiObra ? item.obra_id : selectedObraId
        if (!effectiveObraId) {
          return 'Selecciona el proyecto para la requisición.'
        }

        const disp = getSaldoDisponible(effectiveObraId, item.material_id)
        const mat = materialMap.get(item.material_id)
        const matNombre = mat ? `${mat.nombre_base}${mat.variante ? ` · ${mat.variante}` : ''}` : 'el material'

        if (disp !== null) {
          if (disp <= 0) {
            return `Saldo insuficiente: El material "${matNombre}" no tiene saldo disponible en este proyecto (Disponible: 0).`
          }
          const cantNum = parseQuantity(item.cantidad)
          if (cantNum !== null && cantNum > disp) {
            return `Cantidad excesiva: Para "${matNombre}", solicitas ${cantNum} pero solo hay ${disp} disponible.`
          }
        }
      }
    }
    return null
  }

  async function guardarOffline(formData: FormData) {
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
            setOfflineError('Selecciona material en todos los renglones de material.')
            return
          }
          const cantidad = parseQuantity(item.cantidad)
          if (cantidad === null || cantidad <= 0) {
            setOfflineError('Revisa las cantidades: deben ser mayores a cero.')
            return
          }
          let monto_mxn: number | null = null
          if (item.monto_mxn.trim() !== '') {
            const monto = parseMoney(item.monto_mxn)
            if (monto === null || monto < 0) {
              setOfflineError('Revisa los montos MXN.')
              return
            }
            monto_mxn = monto
          }
          parsedItems.push({
            tipo_linea: 'material',
            material_id: item.material_id,
            cantidad_solicitada: cantidad,
            descripcion: null,
            monto_mxn,
            nota: item.nota.trim() === '' ? null : item.nota.trim(),
          })
        } else {
          if (item.descripcion.trim() === '') {
            setOfflineError('Indica descripción en flete/camiones/mantenimiento/otro.')
            return
          }
          const monto = parseMoney(item.monto_mxn)
          if (monto === null || monto <= 0) {
            setOfflineError('Los renglones no-material requieren monto MXN mayor a cero.')
            return
          }
          parsedItems.push({
            tipo_linea: item.tipo_linea,
            material_id: null,
            cantidad_solicitada: null,
            descripcion: item.descripcion.trim(),
            monto_mxn: monto,
            nota: item.nota.trim() === '' ? null : item.nota.trim(),
          })
        }
      }

      const now = new Date().toISOString()
      const id = crypto.randomUUID()
      await putSolicitudPendiente({
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
    <form action={handleSubmit} className="space-y-4">
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

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Renglones de la Requisición
          </h2>
        </div>

        <div className="space-y-3">
          {items.map((item, index) => {
            const effectiveObraId = multiObra ? item.obra_id : selectedObraId
            const disp = item.material_id ? getSaldoDisponible(effectiveObraId, item.material_id) : null
            const cantNum = parseQuantity(item.cantidad) ?? 0
            const esMaterial = item.tipo_linea === 'material'
            const sinSaldo = esMaterial && item.material_id !== '' && disp !== null && disp <= 0
            const saldoInsuficiente = esMaterial && item.material_id !== '' && disp !== null && disp > 0 && cantNum > disp
            const mat = item.material_id ? materialMap.get(item.material_id) : null

            return (
              <div
                key={item.key}
                className={`card space-y-3 ${
                  sinSaldo || saldoInsuficiente ? 'border-red-300 bg-red-50/30' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400">
                      Renglón {index + 1}
                    </span>
                    {esMaterial && disp !== null && (
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                          disp <= 0
                            ? 'bg-red-100 text-red-700 font-bold'
                            : 'bg-teal-50 text-teal-800'
                        }`}
                      >
                        {disp <= 0
                          ? '⛔ Saldo: 0 (Agotado)'
                          : `Disponible: ${disp} ${mat?.unidad_medida ?? ''}`}
                      </span>
                    )}
                  </div>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => quitarFila(item.key)}
                      className="text-xs text-red-600 font-semibold hover:text-red-800"
                    >
                      ✕ Quitar
                    </button>
                  )}
                </div>

                <select
                  value={item.tipo_linea}
                  onChange={(e) =>
                    actualizarFila(item.key, {
                      tipo_linea: e.target.value as TipoLineaSolicitud,
                      material_id: '',
                      cantidad: '',
                      descripcion: '',
                      monto_mxn: '',
                    })
                  }
                  className="input-base"
                >
                  {TIPOS_LINEA_SOLICITUD.map((t) => (
                    <option key={t} value={t}>
                      {labelTipoLinea(t)}
                    </option>
                  ))}
                </select>

                {multiObra && (
                  <select
                    value={item.obra_id}
                    onChange={(e) => actualizarFila(item.key, { obra_id: e.target.value })}
                    className="input-base"
                    required
                  >
                    <option value="" disabled>
                      Selecciona el proyecto de este renglón
                    </option>
                    {obras.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nombre}
                      </option>
                    ))}
                  </select>
                )}

                {item.tipo_linea === 'material' ? (
                  <>
                    <div>
                      <MaterialSearchCombobox
                        materials={materialesDisponiblesPara(item.key, item.obra_id)}
                        value={item.material_id}
                        onChange={(material_id) =>
                          actualizarFila(item.key, { material_id })
                        }
                      />
                      {sinSaldo && (
                        <p className="text-xs font-semibold text-red-600 mt-1">
                          ⚠️ Este material no tiene presupuesto asignado o se encuentra agotado en el proyecto. No podrás enviar esta requisición.
                        </p>
                      )}
                      {saldoInsuficiente && (
                        <p className="text-xs font-semibold text-red-600 mt-1">
                          ⚠️ La cantidad solicitada ({cantNum}) supera el saldo disponible ({disp}). Ajusta la cantidad.
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                          Cantidad *
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          required
                          placeholder="Cantidad solicitada"
                          value={item.cantidad}
                          onChange={(e) =>
                            actualizarFila(item.key, { cantidad: e.target.value })
                          }
                          className="input-base"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                          Monto MXN estimado (opcional)
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={item.monto_mxn}
                          onChange={(e) =>
                            actualizarFila(item.key, { monto_mxn: e.target.value })
                          }
                          className="input-base"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      required
                      placeholder="Descripción del gasto (flete, flete camión, mantenimiento, etc.)"
                      value={item.descripcion}
                      onChange={(e) =>
                        actualizarFila(item.key, { descripcion: e.target.value })
                      }
                      className="input-base"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      placeholder="Monto estimado MXN *"
                      value={item.monto_mxn}
                      onChange={(e) =>
                        actualizarFila(item.key, { monto_mxn: e.target.value })
                      }
                      className="input-base"
                    />
                  </>
                )}

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
          className="mt-3 w-full rounded-lg border border-dashed border-gray-300 py-3 text-sm font-semibold text-[#1E7F7A] hover:bg-teal-50/50"
        >
          + Agregar otro renglón
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
          className="input-base"
          placeholder="Nota"
        />
      </div>

      <SubmitButton>
        {guardandoOffline ? 'Guardando en el teléfono…' : 'Enviar requisición'}
      </SubmitButton>
      <p className="text-xs text-gray-500 text-center">
        Sin señal: se guarda en este teléfono y se envía al recuperar conexión.
      </p>
    </form>
  )
}
