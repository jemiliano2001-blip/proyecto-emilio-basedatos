'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { MoreSheet } from '@/components/MoreSheet'
import { IconMas } from '@/components/icons'
import { NavIcon } from '@/components/NavIcon'
import { navItemsEnMas, navTabsMovil, type NavContext } from '@/lib/nav'
import type { RolUsuario } from '@/lib/types'
import { cn } from '@/lib/utils'

function tabClass(active: boolean): string {
  return cn(
    'relative flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring rounded-lg',
    active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
  )
}

function ActiveIndicator({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <span
      aria-hidden
      className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-b-full bg-primary"
    />
  )
}

/** Bottom nav móvil/tablet (< lg). En desktop la sustituye AppSidebar. */
export function AppNav({
  rol,
  traspasosDisponibles,
}: {
  rol: RolUsuario | null
  traspasosDisponibles: boolean
}) {
  const pathname = usePathname()
  const [masAbierto, setMasAbierto] = useState(false)

  const ctx: NavContext = { rol, traspasosDisponibles }
  const tabs = navTabsMovil(ctx)
  const enMas = navItemsEnMas(ctx)
  const algunoEnMasActivo =
    enMas.some((item) => item.isActive(pathname)) || pathname.startsWith('/notificaciones')

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur-md lg:hidden print:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Principal"
      >
        <div className="mx-auto flex max-w-2xl items-stretch gap-1 px-2 py-1">
          {tabs.map((item) => {
            const active = item.isActive(pathname)
            return (
              <Link
                key={item.id}
                href={item.href}
                className={tabClass(active)}
                aria-current={active ? 'page' : undefined}
              >
                <NavIcon id={item.icon} className="size-5" />
                {item.shortLabel ?? item.label}
                <ActiveIndicator active={active} />
              </Link>
            )
          })}
          <button
            type="button"
            className={tabClass(algunoEnMasActivo || masAbierto)}
            aria-expanded={masAbierto}
            aria-haspopup="dialog"
            aria-controls="mas-sheet"
            onClick={() => setMasAbierto(true)}
          >
            <IconMas className="size-5" />
            Más
            <ActiveIndicator active={algunoEnMasActivo || masAbierto} />
          </button>
        </div>
      </nav>
      <MoreSheet
        open={masAbierto}
        onClose={() => setMasAbierto(false)}
        items={enMas}
        vistaCampoLimitada={rol === 'personal'}
      />
    </>
  )
}
