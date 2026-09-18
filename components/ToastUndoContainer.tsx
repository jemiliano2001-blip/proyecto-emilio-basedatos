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
      className="fixed bottom-[calc(var(--nav-height)+env(safe-area-inset-bottom,0px)+0.75rem)] lg:bottom-6 left-1/2 lg:left-[calc(50%+var(--sidebar-current)/2)] -translate-x-1/2 z-50 flex items-center gap-3 bg-foreground text-background px-4 py-2.5 rounded-xl shadow-lg border border-background/10 text-xs sm:text-sm animate-slide-in-bottom print:hidden"
    >
      <span className="font-medium text-background">{currentToast.message}</span>
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
        className="font-semibold text-primary-foreground bg-primary hover:bg-primary-hover px-2.5 py-1 rounded-lg transition-colors active:scale-95"
      >
        Deshacer
      </button>
      <button
        type="button"
        onClick={() => {
          if (timerRef.current) clearTimeout(timerRef.current)
          setCurrentToast(null)
        }}
        className="text-background/60 hover:text-background p-1 rounded transition-colors"
        aria-label="Cerrar notificación"
      >
        <IconCerrar className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
