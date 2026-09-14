'use client'

import { useActionState } from 'react'
import {
  aprobarCotizacionAction,
  rechazarCotizacionAction,
  type ActionResult,
} from '@/lib/actions/cotizaciones'
import { FormError } from '@/components/FormError'
import { SubmitButton } from '@/components/SubmitButton'

const initialState: ActionResult = { error: null }

export function AprobarRechazarCotizacion({ cotizacionId }: { cotizacionId: string }) {
  const aprobar = aprobarCotizacionAction.bind(null, cotizacionId)
  const rechazar = rechazarCotizacionAction.bind(null, cotizacionId)
  const [aprobarState, aprobarAction] = useActionState(aprobar, initialState)
  const [rechazarState, rechazarAction] = useActionState(rechazar, initialState)

  return (
    <div className="space-y-3">
      <FormError message={aprobarState.error} />
      <FormError message={rechazarState.error} />
      <form action={aprobarAction}>
        <SubmitButton>Aprobar y emitir OC</SubmitButton>
      </form>
      <form action={rechazarAction}>
        <SubmitButton className="btn-danger w-full">
          Rechazar solicitud
        </SubmitButton>
      </form>
    </div>
  )
}
