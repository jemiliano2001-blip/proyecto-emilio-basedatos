'use client'

import { useFormState } from 'react-dom'
import {
  aprobarPagoSolicitudAction,
  aprobarSolicitudComprasAction,
  rechazarSolicitudAction,
  type ActionResult,
} from '@/lib/actions/solicitudes'
import { FormError } from '@/components/FormError'
import { SubmitButton } from '@/components/SubmitButton'

const initialState: ActionResult = { error: null }

export function AprobarComprasButton({ solicitudId }: { solicitudId: string }) {
  const action = aprobarSolicitudComprasAction.bind(null, solicitudId)
  const [state, formAction] = useFormState(action, initialState)

  return (
    <form action={formAction} className="space-y-2">
      <FormError message={state.error} />
      <SubmitButton>Aprobar (Compras)</SubmitButton>
    </form>
  )
}

export function AprobarPagoButton({ solicitudId }: { solicitudId: string }) {
  const action = aprobarPagoSolicitudAction.bind(null, solicitudId)
  const [state, formAction] = useFormState(action, initialState)

  return (
    <form action={formAction} className="space-y-2">
      <FormError message={state.error} />
      <SubmitButton>Pagar y finalizar (Finanzas)</SubmitButton>
    </form>
  )
}

export function RechazarSolicitudForm({ solicitudId }: { solicitudId: string }) {
  const action = rechazarSolicitudAction.bind(null, solicitudId)
  const [state, formAction] = useFormState(action, initialState)

  return (
    <form action={formAction} className="space-y-2">
      <FormError message={state.error} />
      <input
        name="motivo"
        className="input-base"
        placeholder="Motivo del rechazo (opcional)"
      />
      <button
        type="submit"
        className="btn-danger w-full text-sm"
      >
        Rechazar
      </button>
    </form>
  )
}
