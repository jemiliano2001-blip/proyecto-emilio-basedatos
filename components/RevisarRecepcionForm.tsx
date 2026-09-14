'use client'

import { useActionState } from 'react'
import type { ActionResult } from '@/lib/actions/recepciones'
import { revisarRecepcionAction } from '@/lib/actions/recepciones'
import { FormError } from '@/components/FormError'
import { SubmitButton } from '@/components/SubmitButton'

const initialState: ActionResult = { error: null }

export function RevisarRecepcionForm({ recepcionId }: { recepcionId: string }) {
  const aprobarBound = revisarRecepcionAction.bind(null, recepcionId, true)
  const rechazarBound = revisarRecepcionAction.bind(null, recepcionId, false)
  const [aprobarState, aprobarAction] = useActionState(aprobarBound, initialState)
  const [rechazarState, rechazarAction] = useActionState(rechazarBound, initialState)

  return (
    <div className="space-y-4">
      <FormError message={aprobarState.error ?? rechazarState.error} />
      {(aprobarState.ok || rechazarState.ok) && (
        <p className="rounded-lg bg-teal-50 text-teal-800 text-sm px-3 py-2">
          Revisión guardada.
        </p>
      )}

      <form action={aprobarAction} className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Nota de revisión (opcional al aprobar)
          <textarea name="nota_revision" rows={2} className="input-base mt-1" />
        </label>
        <SubmitButton>Aprobar recepción</SubmitButton>
      </form>

      <form action={rechazarAction} className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Motivo del rechazo
          <textarea
            name="nota_revision"
            required
            rows={2}
            className="input-base mt-1"
            placeholder="Explica por qué se rechaza"
          />
        </label>
        <button
          type="submit"
          className="btn-danger w-full"
        >
          Rechazar recepción
        </button>
      </form>
    </div>
  )
}
