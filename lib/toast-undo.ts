'use client'

export interface ToastUndoOptions {
  message: string
  durationMs?: number
  onUndo: () => void | Promise<void>
}

export type ToastUndoEventDetail = ToastUndoOptions & {
  id: string
}

export const TOAST_UNDO_EVENT = 'obra-toast-undo'

/**
 * Muestra una notificación transitoria con botón "Deshacer" (5 segundos por defecto).
 * Diseñado conforme a design.md: utilitario, sobrio y sin animaciones celebratorias.
 */
export function showToastUndo(options: ToastUndoOptions): string {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  if (typeof window !== 'undefined') {
    const event = new CustomEvent<ToastUndoEventDetail>(TOAST_UNDO_EVENT, {
      detail: {
        id,
        durationMs: options.durationMs ?? 5000,
        message: options.message,
        onUndo: options.onUndo,
      },
    })
    window.dispatchEvent(event)
  }
  return id
}
