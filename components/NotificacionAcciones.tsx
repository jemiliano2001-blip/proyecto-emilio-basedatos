'use client'

import { useActionState } from 'react'
import { FormError } from '@/components/FormError'
import { SubmitButton } from '@/components/SubmitButton'
import {
  abrirNotificacionAction,
  marcarNotificacionLeidaFormAction,
} from '@/lib/actions/notificaciones'

const initial = { error: null }

export function NotificacionAcciones({
  id,
  href,
  leida,
}: {
  id: string
  href: string | null
  leida: boolean
}) {
  const abrir = abrirNotificacionAction.bind(null, id, href ?? '/notificaciones')
  const leer = marcarNotificacionLeidaFormAction.bind(null, id)
  const [abrirState, abrirAction] = useActionState(abrir, initial)
  const [leerState, leerAction] = useActionState(leer, initial)

  return (
    <div className="mt-3 space-y-2">
      <FormError message={abrirState.error ?? leerState.error} />
      <div className="flex flex-wrap gap-2">
        {href && <form action={abrirAction}><SubmitButton className="btn-primary btn-sm">Ver</SubmitButton></form>}
        {!leida && <form action={leerAction}><SubmitButton className="btn-secondary btn-sm">Marcar leído</SubmitButton></form>}
      </div>
    </div>
  )
}
