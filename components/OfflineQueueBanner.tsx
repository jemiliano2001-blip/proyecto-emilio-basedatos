'use client'

import { useOfflineUser } from '@/components/OfflineUserProvider'
import { useCallback, useEffect, useState } from 'react'
import {
  listRecepcionesPendientes,
  listSolicitudesPendientes,
  type RecepcionPendienteRecord,
  type SolicitudPendienteRecord,
} from '@/lib/offline/db'
import { OfflineRecordEditor } from '@/components/OfflineRecordEditor'
import { deleteRecepcionPendiente, deleteSolicitudPendiente } from '@/lib/offline/db'
import { syncOfflineQueues } from '@/lib/offline/sync'

function labelStatus(status: string): string {
  if (status === 'guardado_local') return 'Guardado en este teléfono'
  if (status === 'pendiente') return 'Pendiente de enviar'
  if (status === 'enviado') return 'Enviado'
  if (status === 'conflicto') return 'Necesita revisión'
  if (status === 'necesita_revision') return 'Necesita revisión'
  return status
}

export function OfflineQueueBanner() {
  const userId = useOfflineUser()
  const [recepciones, setRecepciones] = useState<RecepcionPendienteRecord[]>([])
  const [solicitudes, setSolicitudes] = useState<SolicitudPendienteRecord[]>([])
  const [msg, setMsg] = useState<string | null>(null)

  const [editing, setEditing] = useState<SolicitudPendienteRecord | RecepcionPendienteRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const refresh = useCallback(async () => {
    if (!userId) return
    try {
      const [r, s] = await Promise.all([
        listRecepcionesPendientes(userId!),
        listSolicitudesPendientes(userId!),
      ])
      setRecepciones(r)
      setSolicitudes(s)
    } catch {
      // IndexedDB puede fallar en modo privado estricto
    }
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const ownedRecepciones = recepciones.filter(r => r.usuario_id === userId)
  const ownedSolicitudes = solicitudes.filter(s => s.usuario_id === userId)
  const total = ownedRecepciones.length + ownedSolicitudes.length
  if (total === 0) return null

  return (
    <div className="card mb-4 border border-amber-200 bg-amber-50">
      <p className="font-semibold text-sm text-amber-900 mb-2">
        Pendientes en este teléfono ({total})
      </p>
      <ul className="space-y-1 text-xs text-amber-900 mb-3">
        {ownedRecepciones.map((r) => (
          <li key={r.id}>
            Recepción {(r.id ?? '').slice(0, 8)}… — {labelStatus(r.status)}
            {r.error ? ` (${r.error})` : ''}
            <div className="flex gap-4 my-2">
              <button type="button" className="btn-secondary" disabled={busy || r.status !== 'conflicto'} onClick={() => setEditing(r)}>Revisar</button>
              <button type="button" className="btn-secondary text-danger" disabled={busy || r.status !== 'conflicto'} onClick={async () => {
                if (!window.confirm('¿Descartar esta captura guardada? Esta acción no se puede deshacer.')) return
                try { await deleteRecepcionPendiente(r.id); await refresh() } catch { setMsg('No se pudo descartar la captura.') }
              }}>Descartar</button>
            </div>
          </li>
        ))}
        {ownedSolicitudes.map((s) => (
          <li key={s.id}>
            Solicitud {(s.id ?? '').slice(0, 8)}… — {labelStatus(s.status)}
            {s.error ? ` (${s.error})` : ''}
            <div className="flex gap-4 my-2">
              <button type="button" className="btn-secondary" disabled={busy || s.status !== 'conflicto'} onClick={() => setEditing(s)}>Revisar</button>
              <button type="button" className="btn-secondary text-danger" disabled={busy || s.status !== 'conflicto'} onClick={async () => {
                if (!window.confirm('¿Descartar esta captura guardada? Esta acción no se puede deshacer.')) return
                try { await deleteSolicitudPendiente(s.id); await refresh() } catch { setMsg('No se pudo descartar la captura.') }
              }}>Descartar</button>
            </div>
          </li>
        ))}
      </ul>
      {editing && editing.usuario_id === userId && <OfflineRecordEditor key={editing.id} record={editing} onCancel={() => setEditing(null)} onSaved={async () => { setEditing(null); await refresh(); setMsg('Corrección guardada. Pulsa Reintentar envío para enviarla.') }} />}
      {msg && <p className="text-xs text-amber-800 mb-2">{msg}</p>}
      <button
        type="button"
        className="w-full rounded-lg bg-amber-700 text-white font-semibold py-2 text-sm"
        disabled={busy || Boolean(editing)}
        aria-busy={busy}
        onClick={() => {
          setBusy(true)
          void syncOfflineQueues(userId!).then(async (summary) => {
            await refresh()
            if (summary.noAutenticado) {
              setMsg('Sesión expirada. Vuelve a iniciar sesión.')
            } else {
              setMsg(
                `Enviados: ${summary.recepcionesOk + summary.solicitudesOk}. Conflictos: ${summary.conflictos}.`
              )
            }
          }).catch(() => setMsg("No se pudo conectar. Tus capturas siguen guardadas.")).finally(() => setBusy(false))
        }}
      >
        Reintentar envío
      </button>
    </div>
  )
}
