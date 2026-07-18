'use client'

import { useState } from 'react'
import { useFormState } from 'react-dom'
import { updateTopeAction, type ActionResult } from '@/lib/actions/topes'
import { FormError } from '@/components/FormError'
import { SubmitButton } from '@/components/SubmitButton'

const initialState: ActionResult = { error: null }

export function EditTopeInline({
  topeId,
  obraId,
  materialId,
  cantidadActual,
}: {
  topeId: string
  obraId: string
  materialId: string
  cantidadActual: number
}) {
  const [open, setOpen] = useState(false)
  const bound = updateTopeAction.bind(null, topeId, obraId)
  const [state, formAction] = useFormState(bound, initialState)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 text-sm font-semibold text-[#1E7F7A]"
      >
        Editar cantidad
      </button>
    )
  }

  return (
    <form action={formAction} className="mt-3 space-y-3 border-t border-gray-100 pt-3">
      <input type="hidden" name="material_id" value={materialId} />
      <FormError message={state.error} />
      {state.ok && (
        <p className="text-sm text-green-700">Cantidad actualizada.</p>
      )}
      <label className="block text-sm font-medium text-gray-700">
        Nueva cantidad contratada
        <input
          name="cantidad_contratada"
          type="text"
          inputMode="decimal"
          required
          defaultValue={String(cantidadActual)}
          className="input-base mt-1"
        />
      </label>
      <div className="flex gap-2">
        <SubmitButton className="btn-primary flex-1">Guardar</SubmitButton>
        <button
          type="button"
          className="flex-1 rounded-lg border border-gray-300 px-4 py-3 font-semibold"
          onClick={() => setOpen(false)}
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
