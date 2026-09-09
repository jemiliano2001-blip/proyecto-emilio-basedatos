'use client'

import { useEffect, useState } from 'react'
import { IconCerrar } from '@/components/icons'

interface ShortcutRow {
  keyLabel: string
  description: string
  category: string
}

const SHORTCUTS: ShortcutRow[] = [
  {
    keyLabel: 'Ctrl + K  /  ⌘ + K',
    description: 'Abrir buscador global y paleta de comandos',
    category: 'Navegación y Búsqueda',
  },
  {
    keyLabel: '?',
    description: 'Mostrar u ocultar esta guía de atajos',
    category: 'General',
  },
  {
    keyLabel: 'Esc',
    description: 'Cerrar cualquier buscador, diálogo o panel abierto',
    category: 'General',
  },
]

export function KeyboardShortcutsModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si el usuario está escribiendo en un input, textarea o editable
      const target = e.target as HTMLElement | null
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable

      if (e.key === '?' && !isInput) {
        e.preventDefault()
        setOpen((prev) => !prev)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }

    const handleCustomOpen = () => setOpen(true)

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('open-shortcuts-help', handleCustomOpen)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('open-shortcuts-help', handleCustomOpen)
    }
  }, [open])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity print:hidden"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h2 id="shortcuts-dialog-title" className="text-base font-bold text-ink">
              Atajos de Teclado
            </h2>
            <p className="text-xs text-gray-500">Comandos rápidos para navegar con fluidez</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Cerrar ventana de atajos"
          >
            <IconCerrar className="w-5 h-5" />
          </button>
        </div>

        {/* Lista de atajos */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {SHORTCUTS.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors"
            >
              <span className="text-sm font-medium text-gray-700">
                {item.description}
              </span>
              <kbd className="shrink-0 px-2.5 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded shadow-xs">
                {item.keyLabel}
              </kbd>
            </div>
          ))}
        </div>

        {/* Pie */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
          <span>Pulsa <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded font-semibold text-gray-600">Esc</kbd> para salir</span>
          <span>ObraTrack SaaS</span>
        </div>
      </div>
    </div>
  )
}
