'use client'

import { useActionState, useEffect } from 'react'
import type { ActionResult } from '@/lib/actions/topes'
import { FormError } from '@/components/FormError'
import { SubmitButton } from '@/components/SubmitButton'

const initialState: ActionResult = { error: null }

interface MaterialOption {
  id: string
  nombre_base: string
  variante: string | null
  unidad_medida: string
}

export function TopeForm({
  action,
  obraId,
  materiales,
  defaultMaterialId,
  defaultCantidad,
  submitLabel,
  onSuccess,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>
  obraId: string
  materiales: MaterialOption[]
  defaultMaterialId?: string
  defaultCantidad?: number
  submitLabel: string
  onSuccess?: () => void
}) {
  const [state, formAction] = useActionState(action, initialState)

  useEffect(() => {
    if (state.ok && onSuccess) {
      onSuccess()
    }
  }, [state.ok, onSuccess])

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="obra_id" value={obraId} />
      <FormError message={state.error} />
      {state.ok && (
        <div className="card border-green-300 bg-green-50 text-green-800 mb-2">
          Tope guardado.
        </div>
      )}
      <div>
        <label htmlFor="material_id" className="block text-sm font-medium text-gray-700 mb-1">
          Material
        </label>
        <select
          id="material_id"
          name="material_id"
          required
          defaultValue={defaultMaterialId ?? ''}
          className="input-base"
          disabled={Boolean(defaultMaterialId)}
        >
          <option value="" disabled>
            Selecciona un material
          </option>
          {materiales.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre_base}
              {m.variante ? ` · ${m.variante}` : ''} ({m.unidad_medida})
            </option>
          ))}
        </select>
        {defaultMaterialId && (
          <input type="hidden" name="material_id" value={defaultMaterialId} />
        )}
      </div>
      <div>
        <label
          htmlFor="cantidad_contratada"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Cantidad contratada
        </label>
        <input
          id="cantidad_contratada"
          name="cantidad_contratada"
          type="text"
          inputMode="decimal"
          required
          defaultValue={
            defaultCantidad !== undefined ? String(defaultCantidad) : ''
          }
          className="input-base"
          placeholder="0.00"
        />
      </div>
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  )
}
