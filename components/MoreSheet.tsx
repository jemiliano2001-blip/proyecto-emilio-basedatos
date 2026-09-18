'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { logoutAction } from '@/lib/actions/auth'
import { IconCampana, IconCerrar, IconSalir } from '@/components/icons'
import { NavIcon } from '@/components/NavIcon'
import type { NavItem } from '@/lib/nav'
import { cn } from '@/lib/utils'

export function MoreSheet({
  open,
  onClose,
  items,
  vistaCampoLimitada = false,
}: {
  open: boolean
  onClose: () => void
  items: NavItem[]
  vistaCampoLimitada?: boolean
}) {
  const pathname = usePathname()
  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const first = panelRef.current?.querySelector<HTMLElement>('button, a')
    first?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab') {
        const elements = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]') ?? [])
        const first = elements[0], last = elements[elements.length - 1]
        if (!first) { e.preventDefault(); return }
        if (e.shiftKey && (document.activeElement === first || !panelRef.current?.contains(document.activeElement))) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && (document.activeElement === last || !panelRef.current?.contains(document.activeElement))) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previousFocus.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  const itemClass = (active: boolean) =>
    cn(
      'flex min-h-[48px] items-center gap-3 rounded-lg px-3 text-base font-medium transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      active ? 'bg-primary-soft text-primary-soft-foreground' : 'text-foreground hover:bg-muted'
    )

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-foreground/50 backdrop-blur-sm animate-fade-in"
        aria-label="Cerrar menú"
        onClick={onClose}
      />
      <div
        id="mas-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mas-titulo"
        ref={panelRef}
        className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-border bg-card px-4 pt-2 shadow-lg animate-slide-in-bottom"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div aria-hidden className="mx-auto mb-2 h-1 w-10 rounded-full bg-border" />
        <div className="mb-2 flex items-center justify-between">
          <h2 id="mas-titulo" className="text-base font-semibold text-foreground">
            Más
          </h2>
          <button
            type="button"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <IconCerrar className="size-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-0.5">
          {items.map((item) => {
            const active = item.isActive(pathname)
            return (
              <Link
                key={item.id}
                href={item.href}
                className={itemClass(active)}
                onClick={onClose}
                aria-current={active ? 'page' : undefined}
              >
                <NavIcon
                  id={item.icon}
                  className={cn('size-5 shrink-0', active ? 'text-primary' : 'text-muted-foreground')}
                />
                {item.label}
              </Link>
            )
          })}

          <Link
            href="/notificaciones"
            className={itemClass(pathname.startsWith('/notificaciones'))}
            onClick={onClose}
          >
            <IconCampana className="size-5 shrink-0 text-muted-foreground" />
            Avisos
          </Link>

          {vistaCampoLimitada && (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              En campo ves el estatus de tus requisiciones, la recepción y el
              inventario por instalar.
            </p>
          )}
        </nav>

        <form action={logoutAction} className="mt-3 border-t border-border pt-3">
          <button
            type="submit"
            className="flex min-h-[48px] w-full items-center gap-3 rounded-lg px-3 text-left text-base font-medium text-danger hover:bg-danger-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
          >
            <IconSalir className="size-5 shrink-0" />
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  )
}
