'use client'

import React, { useEffect, useState, useRef } from 'react'
import { TOAST_UNDO_EVENT, type ToastUndoEventDetail } from '@/lib/toast-undo'
import { IconCerrar } from '@/components/icons'

export function ToastUndoContainer() {
  const [currentToast, setCurrentToast] = useState<ToastUndoEventDetail | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const handleToast = (e: Event) => {
      const customEvent = e as CustomEvent<ToastUndoEventDetail>
      if (customEvent.detail) {
        if (timerRef.current) clearTimeout(timerRef.current)
        setCurrentToast(customEvent.detail)
        timerRef.current = setTimeout(() => {
          setCurrentToast(null)
        }, customEvent.detail.durationMs ?? 5000)
      }
    }

    window.addEventListener(TOAST_UNDO_EVENT, handleToast)
    return () => {
      window.removeEventListener(TOAST_UNDO_EVENT, handleToast)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  if (!currentToast) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-ink text-white px-4 py-2.5 rounded-xl shadow-2xl border border-white/10 text-xs sm:text-sm animate-slide-in-bottom print:hidden"
    >
      <span className="font-medium text-white">{currentToast.message}</span>
      <button
        type="button"
        onClick={async () => {
          if (timerRef.current) clearTimeout(timerRef.current)
          try {
            await currentToast.onUndo()
          } finally {
            setCurrentToast(null)
          }
        }}
        className="font-bold text-accent-foreground bg-accent hover:bg-teal-600 px-2.5 py-1 rounded-lg transition-colors active:scale-95"
      >
        Deshacer
      </button>
      <button
        type="button"
        onClick={() => {
          if (timerRef.current) clearTimeout(timerRef.current)
          setCurrentToast(null)
        }}
        className="text-gray-300 hover:text-white p-1 rounded transition-colors"
        aria-label="Cerrar notificación"
      >
        <IconCerrar className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
