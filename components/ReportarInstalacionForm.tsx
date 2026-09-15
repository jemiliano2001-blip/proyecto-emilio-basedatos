'use client'

import { useActionState, useState } from 'react'
import {
  reportarInstalacionAction,
  type InventarioActionResult,
} from '@/lib/actions/inventario'
import { FormError } from '@/components/FormError'
import { SubmitButton } from '@/components/SubmitButton'

const initial: InventarioActionResult = { error: null }

export function ReportarInstalacionForm({
  obraId,
  materialId,
  pendiente,
  unidad,
}: {
  obraId: string
  materialId: string
  pendiente: number
  unidad: string
}) {
  const action = reportarInstalacionAction.bind(null, obraId, materialId)
  const [state, formAction] = useActionState(action, initial)
  const [offlineError, setOfflineError] = useState<string | null>(null)

  if (pendiente <= 0) {
    return <p className="text-xs text-teal-800 font-medium">Todo instalado</p>
  }

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        setOfflineError(null)
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          event.preventDefault()
          setOfflineError('El reporte de instalación necesita conexión; todavía no tiene cola local.')
        }
      }}
      className="space-y-2 mt-2"
    >
      <FormError message={state.error ?? offlineError} />
      {state.ok && (
        <p className="text-xs text-teal-800 font-medium">Instalación registrada.</p>
      )}
      <div className="flex gap-2 items-end">
        <label className="flex-1 text-xs font-semibold text-gray-600">
          Instalar ({unidad})
          <input
            name="cantidad"
            type="text"
            inputMode="decimal"
            required
            defaultValue={String(pendiente)}
            className="input-base mt-1 text-sm"
            placeholder="0"
          />
        </label>
        <div className="shrink-0 pb-0.5">
          <SubmitButton className="text-xs px-3 py-2">Reportar</SubmitButton>
        </div>
      </div>
      <input
        name="nota"
        type="text"
        className="input-base text-sm"
        placeholder="Nota (opcional)"
      />
      <p className="text-[11px] text-gray-400">
        Pendiente: {pendiente} {unidad}
      </p>
    </form>
  )
}
