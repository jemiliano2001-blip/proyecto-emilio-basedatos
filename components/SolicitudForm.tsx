'use client'

import { useMemo, useState } from 'react'
import { useFormState } from 'react-dom'
import { useRouter } from 'next/navigation'
import type { ActionResult } from '@/lib/actions/solicitudes'
import { FormError } from '@/components/FormError'
import { SubmitButton } from '@/components/SubmitButton'
import { putSolicitudPendiente } from '@/lib/offline/db'
import { parseQuantity } from '@/lib/money'

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
}

interface ItemRow {
  key: string
  material_id: string
  cantidad: string
  nota: string
}

function nuevaFila(): ItemRow {
  return {
    key: crypto.randomUUID(),
    material_id: '',
    cantidad: '',
    nota: '',
  }
}

export function SolicitudForm({
  action,
  obras,
  materiales,
  defaultObraId,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>
  obras: ObraOption[]
  materiales: MaterialOption[]
  defaultObraId?: string
}) {
  const router = useRouter()
  const [state, formAction] = useFormState(action, initialState)
  const [items, setItems] = useState<ItemRow[]>([nuevaFila()])
  const [offlineMsg, setOfflineMsg] = useState<string | null>(null)
  const [offlineError, setOfflineError] = useState<string | null>(null)
  const [guardandoOffline, setGuardandoOffline] = useState(false)

  const itemsJson = useMemo(
    () =>
      JSON.stringify(
        items.map((item) => ({
          material_id: item.material_id,
          cantidad_solicitada: item.cantidad,
          nota: item.nota,
        }))
      ),
    [items]
  )

  function actualizarFila(key: string, cambios: Partial<ItemRow>) {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...cambios } : item)))
  }

  function agregarFila() {
    setItems((prev) => [...prev, nuevaFila()])
  }

  function quitarFila(key: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((item) => item.key !== key) : prev))
  }

  function materialesDisponiblesPara(key: string) {
    const usados = new Set(
      items.filter((i) => i.key !== key && i.material_id).map((i) => i.material_id)
    )
    return materiales.filter((m) => !usados.has(m.id))
  }

  async function guardarOffline(formData: FormData) {
    setOfflineError(null)
    setOfflineMsg(null)
    setGuardandoOffline(true)

    try {
      const obra_id = String(formData.get('obra_id') ?? '')
      const notaRaw = formData.get('nota')
      const nota =
        typeof notaRaw === 'string' && notaRaw.trim() !== '' ? notaRaw.trim() : null

      if (!obra_id) {
        setOfflineError('Selecciona una obra.')
        return
      }

      const parsedItems: {
        material_id: string
        cantidad_solicitada: number
        nota: string | null
      }[] = []

      for (const item of items) {
        if (!item.material_id) {
          setOfflineError('Selecciona material en todos los renglones.')
          return
        }
        const cantidad = parseQuantity(item.cantidad)
        if (cantidad === null || cantidad <= 0) {
          setOfflineError('Revisa las cantidades: deben ser mayores a cero.')
          return
        }
        parsedItems.push({
          material_id: item.material_id,
          cantidad_solicitada: cantidad,
          nota: item.nota.trim() === '' ? null : item.nota.trim(),
        })
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

      setOfflineMsg(
        'Guardado en este teléfono. Se enviará cuando haya conexión.'
      )
      router.push('/solicitudes')
    } catch {
      setOfflineError('No se pudo guardar en este teléfono. Intenta de nuevo.')
    } finally {
      setGuardandoOffline(false)
    }
  }

  function handleSubmit(formData: FormData) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      void guardarOffline(formData)
      return
    }
    formAction(formData)
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <input type="hidden" name="items_json" value={itemsJson} />
      <FormError message={state.error ?? offlineError} />
      {offlineMsg && (
        <p className="rounded-lg bg-teal-50 text-teal-800 text-sm px-3 py-2">{offlineMsg}</p>
      )}

      <div>
        <label htmlFor="obra_id" className="block text-sm font-medium text-gray-700 mb-1">
          Obra
        </label>
        <select
          id="obra_id"
          name="obra_id"
          required
          defaultValue={defaultObraId ?? ''}
          className="input-base"
        >
          <option value="" disabled>
            Selecciona una obra
          </option>
          {obras.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nombre}
              {o.fraccionamiento ? ` · ${o.fraccionamiento}` : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Materiales
          </h2>
        </div>

        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={item.key} className="card space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400">
                  Material {index + 1}
                </span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => quitarFila(item.key)}
                    className="text-sm text-red-600 font-medium"
                  >
                    Quitar
                  </button>
                )}
              </div>

              <select
                required
                value={item.material_id}
                onChange={(e) => actualizarFila(item.key, { material_id: e.target.value })}
                className="input-base"
              >
                <option value="" disabled>
                  Selecciona un material
                </option>
                {materialesDisponiblesPara(item.key).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre_base}
                    {m.variante ? ` · ${m.variante}` : ''} ({m.unidad_medida})
                  </option>
                ))}
              </select>

              <input
                type="text"
                inputMode="decimal"
                required
                placeholder="Cantidad"
                value={item.cantidad}
                onChange={(e) => actualizarFila(item.key, { cantidad: e.target.value })}
                className="input-base"
              />

              <input
                type="text"
                placeholder="Nota (opcional) — ej. urge para mañana"
                value={item.nota}
                onChange={(e) => actualizarFila(item.key, { nota: e.target.value })}
                className="input-base"
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={agregarFila}
          className="mt-3 w-full rounded-lg border border-dashed border-gray-300 py-3 text-sm font-semibold text-[#1E7F7A]"
        >
          + Agregar otro material
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
          placeholder="Cualquier detalle para Compras"
        />
      </div>

      <SubmitButton>
        {guardandoOffline ? 'Guardando en el teléfono…' : 'Enviar solicitud'}
      </SubmitButton>
      <p className="text-xs text-gray-500 text-center">
        Sin señal: se guarda en este teléfono y se envía al recuperar conexión.
      </p>
    </form>
  )
}
