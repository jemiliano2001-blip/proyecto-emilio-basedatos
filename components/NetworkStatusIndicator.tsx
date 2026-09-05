'use client'

import { useSyncExternalStore, useState, useEffect } from 'react'
import { IconWifiOff, IconCheck } from '@/components/icons'

function subscribe(callback: () => void) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

function getSnapshot() {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine
}

function getServerSnapshot() {
  return true
}

export function NetworkStatusIndicator() {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [showRestored, setShowRestored] = useState(false)
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true)
    } else if (wasOffline) {
      setShowRestored(true)
      const timer = setTimeout(() => {
        setShowRestored(false)
        setWasOffline(false)
      }, 3500)
      return () => clearTimeout(timer)
    }
  }, [isOnline, wasOffline])

  if (!isOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed top-0 inset-x-0 z-50 bg-amber-600 text-white text-xs font-semibold px-4 py-2 text-center flex items-center justify-center gap-2 shadow-md print:hidden"
      >
        <IconWifiOff className="h-4 w-4 shrink-0" />
        <span>Sin conexión a internet. Los registros capturados en campo se guardarán localmente.</span>
      </div>
    )
  }

  if (showRestored) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed top-0 inset-x-0 z-50 bg-teal-700 text-white text-xs font-semibold px-4 py-2 text-center flex items-center justify-center gap-2 shadow-md print:hidden"
      >
        <IconCheck className="h-4 w-4 shrink-0" />
        <span>Conexión restablecida. Sistema en línea.</span>
      </div>
    )
  }

  return null
}
