'use client'

import { usePathname } from 'next/navigation'
import { NotificacionCampanita } from '@/components/NotificacionCampanita'
import { IconSearch } from '@/components/icons'
import { tituloDeRuta } from '@/lib/nav'

export function TopBar({ nombre }: { nombre: string | null }) {
  const pathname = usePathname()
  const titulo = tituloDeRuta(pathname)

  return (
    <header className="glass-header">
      <div
        className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="min-w-0 py-3">
          <p className="truncate text-base font-bold text-ink">{titulo}</p>
          {nombre && (
            <p className="truncate text-xs text-gray-500">{nombre}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
            className="p-2 rounded-lg text-gray-500 hover:text-ink hover:bg-gray-100 transition-colors"
            title="Buscador y comandos (Ctrl+K)"
            aria-label="Abrir buscador y comandos"
          >
            <IconSearch className="w-5 h-5" />
          </button>
          <NotificacionCampanita />
        </div>
      </div>
    </header>
  )
}
