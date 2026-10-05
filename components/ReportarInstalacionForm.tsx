'use client'

import { useActionState, useState, useEffect } from 'react'
import {
  reportarInstalacionAction,
  type InventarioActionResult,
} from '@/lib/actions/inventario'
import { FormError } from '@/components/FormError'
import { SubmitButton } from '@/components/SubmitButton'
import { useOfflineUser } from '@/components/OfflineUserProvider'
import { putInstalacionPendiente } from '@/lib/offline/db'
import { validateInstalacionInput } from '@/lib/validations/instalacion'

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
  const [id, setId] = useState('')
  const [localMessage, setLocalMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const userId = useOfflineUser()
  useEffect(() => { setId(crypto.randomUUID()) }, [])
  useEffect(() => { if (state.ok) setId(crypto.randomUUID()) }, [state])

  if (pendiente <= 0) {
    return <p className="text-xs text-primary-soft-foreground font-medium">Todo instalado</p>
  }

  return (
    <form
      action={formAction}
      onSubmit={async (event) => {
        setOfflineError(null)
        setLocalMessage(null)
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          event.preventDefault()
          if (!userId) { setOfflineError('Inicia sesión antes de guardar capturas en este teléfono.'); return }
          const form = event.currentTarget
          const data = new FormData(form)
          const parsed = validateInstalacionInput({id,obra_id:obraId,material_id:materialId,cantidad:data.get('cantidad'),nota:data.get('nota')})
          if (!parsed.ok) { setOfflineError(parsed.error); return }
          setSaving(true)
          try {
            const now = new Date().toISOString()
            await putInstalacionPendiente({...parsed.data,usuario_id:userId,status:'guardado_local',error:null,created_at:now,updated_at:now})
            setId(crypto.randomUUID())
            setLocalMessage('Guardado en este teléfono. Se enviará al recuperar conexión; todavía no modifica el inventario.')
            window.dispatchEvent(new Event('offline-queue-changed'))
          } catch { setOfflineError('No se pudo guardar la instalación en este teléfono. Conserva la captura y reintenta.') }
          finally { setSaving(false) }
        }
      }}
      className="space-y-2 mt-2"
    >
      <FormError message={state.error ?? offlineError} />
      <input type="hidden" name="id" value={id} />
      {localMessage && <p role="status" className="text-xs text-primary">{localMessage}</p>}
      {state.ok && !localMessage && (
        <p className="text-xs text-primary-soft-foreground font-medium">Instalación registrada.</p>
      )}
      <div className="flex gap-2 items-end">
        <label className="flex-1 text-xs font-semibold text-muted-foreground">
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
          <SubmitButton disabled={saving || !id} className="text-xs px-3 py-2">Reportar</SubmitButton>
        </div>
      </div>
      <input
        name="nota"
        type="text"
        className="input-base text-sm"
        placeholder="Nota (opcional)"
      />
      <p className="text-[11px] text-muted-foreground">
        Pendiente: {pendiente} {unidad}
      </p>
    </form>
  )
}
