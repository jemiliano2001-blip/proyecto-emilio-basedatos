'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Fragment } from 'react'
import { NotificacionCampanita } from '@/components/NotificacionCampanita'
import { IconChevron, IconLogo, IconSearch, IconAbastecimiento } from '@/components/icons'
import { migasDeRuta, tituloDeRuta } from '@/lib/nav'

export function TopBar({ nombre }: { nombre: string | null }) {
  const pathname = usePathname()
  const titulo = tituloDeRuta(pathname)
  const migas = migasDeRuta(pathname)

  return (
    <header className="glass-header">
      <div
        className="flex h-topbar items-center justify-between gap-3 px-4 sm:px-6 lg:px-8"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {/* Izquierda · móvil: marca + título · desktop: migas */}
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm lg:hidden"
            aria-label="Inicio"
          >
            <IconLogo className="size-5" />
          </Link>
          <div className="min-w-0 lg:hidden">
            <p className="truncate text-base font-semibold text-foreground">{titulo}</p>
          </div>

          <nav aria-label="Ubicación" className="hidden min-w-0 lg:block">
            <ol className="flex min-w-0 items-center gap-1.5 text-sm">
              {migas.length === 0 && (
                <li className="font-medium text-foreground">{titulo}</li>
              )}
              {migas.map((miga, index) => {
                const last = index === migas.length - 1
                return (
                  <Fragment key={`${miga.href}-${index}`}>
                    {index > 0 && (
                      <li aria-hidden className="text-muted-foreground/60">
                        <IconChevron className="size-3.5" />
                      </li>
                    )}
                    <li className="min-w-0">
                      {last ? (
                        <span aria-current="page" className="block truncate font-medium text-foreground">
                          {miga.label}
                        </span>
                      ) : (
                        <Link
                          href={miga.href}
                          className="block truncate text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {miga.label}
                        </Link>
                      )}
                    </li>
                  </Fragment>
                )
              })}
            </ol>
          </nav>
        </div>

        {/* Derecha · buscador, control de abastecimiento, avisos */}
        <div className="flex shrink-0 items-center gap-1">
          {nombre && (
            <span className="mr-2 hidden max-w-[14rem] truncate text-sm text-muted-foreground xl:inline">
              {nombre}
            </span>
          )}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg px-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-[40px] lg:min-w-[40px]"
            title="Buscador y comandos (Ctrl+K)"
            aria-label="Buscar (⌘K)"
          >
            <IconSearch className="size-5 lg:size-[18px]" aria-hidden="true" />
            <kbd className="kbd hidden sm:inline-flex" aria-hidden="true">⌘K</kbd>
          </button>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-abastecimiento-drawer'))}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-[40px] lg:min-w-[40px]"
            title="Control de abastecimiento y pendientes"
            aria-label="Abrir control de abastecimiento y pendientes"
          >
            <IconAbastecimiento className="size-5 lg:size-[18px]" />
          </button>
          <NotificacionCampanita />
        </div>
      </div>
    </header>
  )
}
