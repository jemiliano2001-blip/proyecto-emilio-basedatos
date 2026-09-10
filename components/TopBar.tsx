'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NotificacionCampanita } from '@/components/NotificacionCampanita'
import { IconSearch } from '@/components/icons'
import { tituloDeRuta } from '@/lib/nav'
import type { RolUsuario } from '@/lib/types'

export function TopBar({
  nombre,
  rol,
}: {
  nombre: string | null
  rol?: RolUsuario | null
}) {
  const pathname = usePathname()
  const titulo = tituloDeRuta(pathname)

  const enProyectos = pathname === '/' || pathname.startsWith('/obras')
  const enSolicitudes = pathname.startsWith('/solicitudes')
  const enRecepciones = pathname.startsWith('/recepciones')
  const enMateriales = pathname.startsWith('/materiales')
  const enOrdenes = pathname.startsWith('/ordenes')
  const enTraspasos = pathname.startsWith('/traspasos')

  const desktopLinkClass = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
      active
        ? 'bg-slate-100 text-ink font-bold'
        : 'text-gray-500 hover:text-ink hover:bg-slate-50'
    }`

  return (
    <header className="glass-header">
      <div
        className="mx-auto flex max-w-2xl md:max-w-5xl lg:max-w-6xl items-center justify-between gap-4 px-4"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {/* Izquierda: Título en móvil / Logo + Título en Desktop */}
        <div className="min-w-0 py-2.5 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="w-8 h-8 rounded-lg bg-navy text-teal-300 font-black text-sm flex items-center justify-center shadow-xs">
              OT
            </span>
            <div className="hidden lg:block leading-none">
              <span className="text-xs font-black tracking-wider text-ink uppercase">
                ObraTrack
              </span>
              <p className="text-[10px] text-teal-800 font-medium tracking-tight">
                Emilio SaaS
              </p>
            </div>
          </Link>

          <div className="border-l border-gray-200 pl-3 hidden sm:block min-w-0">
            <p className="truncate text-sm font-bold text-ink">{titulo}</p>
            {nombre && (
              <p className="truncate text-[11px] text-gray-500">{nombre}</p>
            )}
          </div>
          <div className="sm:hidden min-w-0">
            <p className="truncate text-base font-bold text-ink">{titulo}</p>
          </div>
        </div>

        {/* Centro: Enlaces de navegación en Desktop (>= md) */}
        <nav className="hidden md:flex items-center gap-1">
          <Link href="/" className={desktopLinkClass(enProyectos)}>
            Proyectos
          </Link>
          <Link href="/solicitudes" className={desktopLinkClass(enSolicitudes)}>
            Solicitudes
          </Link>
          {rol !== 'finanzas' && (
            <Link href="/recepciones" className={desktopLinkClass(enRecepciones)}>
              Recepción
            </Link>
          )}
          <Link href="/materiales" className={desktopLinkClass(enMateriales)}>
            Catálogo
          </Link>
          {rol === 'finanzas' || rol === 'compras' || rol === 'acceso_total' ? (
            <Link href="/ordenes" className={desktopLinkClass(enOrdenes)}>
              Órdenes
            </Link>
          ) : null}
          {rol === 'proyectos' || rol === 'operacion' || rol === 'acceso_total' ? (
            <Link href="/traspasos" className={desktopLinkClass(enTraspasos)}>
              Traspasos
            </Link>
          ) : null}
        </nav>

        {/* Derecha: Buscador, Notificaciones y Atajo */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-gray-500 hover:text-ink hover:bg-gray-100 border border-transparent sm:border-gray-200 transition-colors text-xs"
            title="Buscador y comandos (Ctrl+K)"
            aria-label="Abrir buscador y comandos"
          >
            <IconSearch className="w-4 h-4" />
            <span className="hidden lg:inline text-gray-400">Buscar...</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-gray-100 text-gray-500 rounded border border-gray-200">
              ⌘K
            </kbd>
          </button>
          <NotificacionCampanita />
        </div>
      </div>
    </header>
  )
}
