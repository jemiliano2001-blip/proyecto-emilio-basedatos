'use client'

import { useEffect, useState } from 'react'
import { syncOfflineQueues } from '@/lib/offline/sync'

export function ServiceWorkerRegistration() {
  const [mensaje, setMensaje] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    let cancelled = false

    navigator.serviceWorker
      .register('/sw.js')
      .catch(() => {
        // Silencioso: la app sigue funcionando online sin SW.
      })

    async function runSync() {
      try {
        const summary = await syncOfflineQueues()
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
  }, [])

  if (!mensaje) return null

  return (
    <div className="fixed top-0 inset-x-0 z-30 bg-accent text-white text-sm px-4 py-2 text-center shadow-md">
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
        <p>{mensaje}</p>
        <button
          type="button"
          className="underline font-semibold shrink-0"
          onClick={() => {
            void syncOfflineQueues().then((summary) => {
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
            })
          }}
        >
          Reintentar
        </button>
      </div>
    </div>
  )
}
