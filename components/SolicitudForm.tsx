'use client'

import { useMemo, useState } from 'react'
import { useFormState } from 'react-dom'
import type { ActionResult } from '@/lib/actions/solicitudes'
import { FormError } from '@/components/FormError'
import { SubmitButton } from '@/components/SubmitButton'

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
  const [state, formAction] = useFormState(action, initialState)
  const [items, setItems] = useState<ItemRow[]>([nuevaFila()])

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

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="items_json" value={itemsJson} />
      <FormError message={state.error} />

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

      <SubmitButton>Enviar solicitud</SubmitButton>
    </form>
  )
}
