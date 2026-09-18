'use client'

import { useEffect, useRef, useState } from 'react'
import { IconCerrar } from '@/components/icons'
import { useModalFocus } from '@/lib/hooks/useModalFocus'

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
    keyLabel: 'Ctrl + B  /  ⌘ + B',
    description: 'Contraer o expandir el menú lateral (escritorio)',
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
  {
    keyLabel: 'Espacio',
    description: 'Abrir el elemento enfocado o cerrar una vista previa',
    category: 'Archivos y catálogo',
  },
  {
    keyLabel: 'Shift + clic',
    description: 'Seleccionar un rango de requisiciones o materiales',
    category: 'Selección en lote',
  },
]

export function KeyboardShortcutsModal() {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  useModalFocus(open, dialogRef)

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/60 backdrop-blur-sm transition-opacity print:hidden"
      onClick={() => setOpen(false)}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-md bg-card rounded-xl shadow-2xl border border-border overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/40">
          <div>
            <h2 id="shortcuts-dialog-title" className="text-base font-bold text-foreground">
              Atajos de Teclado
            </h2>
            <p className="text-xs text-muted-foreground">Comandos rápidos para navegar con fluidez</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
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
              className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-muted border border-transparent hover:border-border transition-colors"
            >
              <span className="text-sm font-medium text-foreground">
                {item.description}
              </span>
              <kbd className="shrink-0 px-2.5 py-1 text-xs font-semibold text-foreground bg-muted border border-border rounded shadow-xs">
                {item.keyLabel}
              </kbd>
            </div>
          ))}
        </div>

        {/* Pie */}
        <div className="px-5 py-3 bg-muted/40 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>Pulsa <kbd className="px-1.5 py-0.5 bg-card border border-border rounded font-semibold text-foreground">Esc</kbd> para salir</span>
          <span>ObraTrack SaaS</span>
        </div>
      </div>
    </div>
  )
}
