'use client'

import { useEffect, useState } from 'react'
import {
  listRecepcionesPendientes,
  listSolicitudesPendientes,
  type RecepcionPendienteRecord,
  type SolicitudPendienteRecord,
} from '@/lib/offline/db'
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
  const [recepciones, setRecepciones] = useState<RecepcionPendienteRecord[]>([])
  const [solicitudes, setSolicitudes] = useState<SolicitudPendienteRecord[]>([])
  const [msg, setMsg] = useState<string | null>(null)

  async function refresh() {
    try {
      const [r, s] = await Promise.all([
        listRecepcionesPendientes(),
        listSolicitudesPendientes(),
      ])
      setRecepciones(r)
      setSolicitudes(s)
    } catch {
      // IndexedDB puede fallar en modo privado estricto
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const total = recepciones.length + solicitudes.length
  if (total === 0) return null

  return (
    <div className="card mb-4 border border-amber-200 bg-amber-50">
      <p className="font-semibold text-sm text-amber-900 mb-2">
        Pendientes en este teléfono ({total})
      </p>
      <ul className="space-y-1 text-xs text-amber-900 mb-3">
        {recepciones.map((r) => (
          <li key={r.id}>
            Recepción {(r.id ?? '').slice(0, 8)}… — {labelStatus(r.status)}
            {r.error ? ` (${r.error})` : ''}
          </li>
        ))}
        {solicitudes.map((s) => (
          <li key={s.id}>
            Solicitud {(s.id ?? '').slice(0, 8)}… — {labelStatus(s.status)}
            {s.error ? ` (${s.error})` : ''}
          </li>
        ))}
      </ul>
      {msg && <p className="text-xs text-amber-800 mb-2">{msg}</p>}
      <button
        type="button"
        className="w-full rounded-lg bg-amber-700 text-white font-semibold py-2 text-sm"
        onClick={() => {
          void syncOfflineQueues().then(async (summary) => {
            await refresh()
            if (summary.noAutenticado) {
              setMsg('Sesión expirada. Vuelve a iniciar sesión.')
            } else {
              setMsg(
                `Enviados: ${summary.recepcionesOk + summary.solicitudesOk}. Conflictos: ${summary.conflictos}.`
              )
            }
          })
        }}
      >
        Reintentar envío
      </button>
    </div>
  )
}
