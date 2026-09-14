'use client'

import { useActionState, useState } from 'react'
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
  const [state, formAction] = useActionState(bound, initialState)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 text-sm font-semibold text-accent hover:underline"
      >
        Editar cantidad
      </button>
    )
  }

  return (
    <form action={formAction} className="mt-3 space-y-3 border-t border-rule pt-3">
      <input type="hidden" name="material_id" value={materialId} />
      <FormError message={state.error} />
      {state.ok && (
        <p className="text-sm text-green-700">Cantidad actualizada.</p>
      )}
      <label className="block text-sm font-medium text-ink">
        Nueva cantidad contratada
        <input
          name="cantidad_contratada"
          type="text"
          inputMode="decimal"
          required
          defaultValue={String(cantidadActual)}
          className="input-base mt-1"
          autoFocus
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              setOpen(false)
            }
          }}
          onBlur={(event) => {
            const next = event.relatedTarget
            if (!(next instanceof Node) || !event.currentTarget.form?.contains(next)) {
              event.currentTarget.form?.requestSubmit()
            }
          }}
        />
      </label>
      <div className="flex gap-2">
        <SubmitButton className="btn-primary flex-1">Guardar</SubmitButton>
        <button
          type="button"
          className="btn-secondary flex-1"
          onClick={() => setOpen(false)}
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
