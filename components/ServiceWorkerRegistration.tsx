'use client'

import { useOfflineUser } from '@/components/OfflineUserProvider'
import { useEffect, useState } from 'react'
import { syncOfflineQueues } from '@/lib/offline/sync'

export function ServiceWorkerRegistration() {
  const userId = useOfflineUser()
  const [mensaje, setMensaje] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    let cancelled = false

    // En desarrollo el SW cachea chunks de /_next/static con nombre estable y
    // sirve JS viejo tras cada cambio (rompe HMR e hidratación). Solo en prod.
    if (process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .catch(() => {
          // Silencioso: la app sigue funcionando online sin SW.
        })
    }

    async function runSync() {
      if (!userId) return
      try {
        const summary = await syncOfflineQueues(userId!)
        if (cancelled) return
        if (summary.noAutenticado) {
          setMensaje('Hay cambios guardados en este teléfono. Inicia sesión para enviarlos.')
          return
        }
        const total = summary.recepcionesOk + summary.solicitudesOk
        if (total > 0) {
          setMensaje(`Se enviaron ${total} registro(s) pendientes.`)
        } else if (summary.conflictos > 0) {
          setMensaje('Hay registros locales que necesitan revisión.')
        } else {
          setMensaje(null)
        }
      } catch {
        // No romper la UI por fallos de sync.
      }
    }

    void runSync()

    function onOnline() {
      void runSync()
    }

    window.addEventListener('online', onOnline)
    return () => {
      cancelled = true
      window.removeEventListener('online', onOnline)
    }
  }, [userId])

  if (!mensaje) return null

  return (
    <div className="fixed top-0 inset-x-0 z-30 bg-primary text-primary-foreground text-sm px-4 py-2 text-center shadow-md">
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
        <p>{mensaje}</p>
        <button
          type="button"
          className="underline font-semibold shrink-0"
          onClick={() => {
            void syncOfflineQueues(userId!).then((summary) => {
              const total = summary.recepcionesOk + summary.solicitudesOk
              if (summary.noAutenticado) {
                setMensaje('Sesión expirada. Vuelve a iniciar sesión.')
              } else if (total > 0) {
                setMensaje(`Se enviaron ${total} registro(s).`)
              } else if (summary.conflictos > 0) {
                setMensaje('Quedan conflictos por revisar.')
              } else {
                setMensaje('Nada pendiente por enviar.')
              }
            }).catch(() => setMensaje("No se pudo conectar. Las capturas siguen guardadas."))
          }}
        >
          Reintentar
        </button>
      </div>
    </div>
  )
}
