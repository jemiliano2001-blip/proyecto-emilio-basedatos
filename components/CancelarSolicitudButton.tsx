'use client'

import { useActionState, useState } from 'react'
import { cancelSolicitudAction, type ActionResult } from '@/lib/actions/solicitudes'
import { FormError } from '@/components/FormError'
import { SubmitButton } from '@/components/SubmitButton'

const initialState: ActionResult = { error: null }

export function CancelarSolicitudButton({ solicitudId }: { solicitudId: string }) {
  const [confirmando, setConfirmando] = useState(false)
  const bound = cancelSolicitudAction.bind(null, solicitudId)
  const [state, formAction] = useActionState(bound, initialState)

  if (state.ok) {
    return <p className="text-sm text-muted-foreground">Solicitud cancelada.</p>
  }

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="text-sm font-semibold text-danger"
      >
        Cancelar solicitud
      </button>
    )
  }

  return (
    <form action={formAction} className="space-y-3 border-t border-border pt-3">
      <FormError message={state.error} />
      <p className="text-sm text-foreground">¿Seguro que quieres cancelar esta solicitud?</p>
      <div className="flex gap-2">
        <SubmitButton className="btn-danger flex-1">
          Sí, cancelar
        </SubmitButton>
        <button
          type="button"
          className="btn-secondary flex-1"
          onClick={() => setConfirmando(false)}
        >
          Volver
        </button>
      </div>
    </form>
  )
}
