'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { IconLogo, IconPanelLeft, IconSalir, IconSearch } from '@/components/icons'
import { NavIcon } from '@/components/NavIcon'
import { logoutAction } from '@/lib/actions/auth'
import { NAV_SECTIONS, SIDEBAR_COOKIE, navItemsVisibles, type NavContext } from '@/lib/nav'
import type { RolUsuario } from '@/lib/types'
import { cn } from '@/lib/utils'
import { etiquetaRol } from '@/lib/validations/usuarios'

function iniciales(nombre: string | null, email: string | null): string {
  const fuente = (nombre ?? email ?? '').trim()
  if (!fuente) return '·'
  const partes = fuente.split(/\s+/).filter(Boolean)
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase()
  return fuente.slice(0, 2).toUpperCase()
}

export function AppSidebar({
  rol,
  nombre,
  email,
  traspasosDisponibles,
  defaultCollapsed = false,
}: {
  rol: RolUsuario | null
  nombre: string | null
  email: string | null
  traspasosDisponibles: boolean
  defaultCollapsed?: boolean
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  const ctx: NavContext = { rol, traspasosDisponibles }
  const items = navItemsVisibles(ctx)

  useEffect(() => {
    document.documentElement.dataset.sidebar = collapsed ? 'collapsed' : 'expanded'
  }, [collapsed])

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      document.cookie = `${SIDEBAR_COOKIE}=${next ? '1' : '0'}; path=/; max-age=31536000; samesite=lax`
      return next
    })
  }, [])

  // Atajo: Ctrl/Cmd + B alterna el sidebar (convención de editores/SaaS)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b') {
        const target = e.target as HTMLElement | null
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  return (
    <aside
      data-collapsed={collapsed}
      aria-label="Navegación principal"
      className={cn(
        'fixed inset-y-0 left-0 z-40 hidden lg:flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground print:hidden',
        'transition-[width] duration-200 ease-out',
        collapsed ? 'w-sidebar-collapsed' : 'w-sidebar'
      )}
    >
      {/* Marca */}
      <div
        className={cn(
          'flex h-topbar shrink-0 items-center border-b border-sidebar-border',
          collapsed ? 'justify-center px-2' : 'justify-between pl-4 pr-2'
        )}
      >
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title="ObraTrack"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <IconLogo className="size-5" />
          </span>
          {!collapsed && (
            <span className="truncate text-[15px] font-semibold tracking-tight text-foreground">
              ObraTrack
            </span>
          )}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={toggle}
            className="inline-flex size-9 items-center justify-center rounded-md text-sidebar-muted hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Contraer menú"
            title="Contraer menú (Ctrl+B)"
          >
            <IconPanelLeft className="size-[18px]" />
          </button>
        )}
      </div>

      {/* Buscar / comandos */}
      <div className={cn('px-2 pt-3', collapsed && 'flex justify-center')}>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
          className={cn(
            'flex items-center gap-2 rounded-lg border border-border bg-background text-sm text-muted-foreground shadow-xs',
            'hover:border-input hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            collapsed ? 'size-10 justify-center border-transparent bg-transparent shadow-none' : 'h-10 w-full px-3'
          )}
          aria-label="Abrir buscador y comandos"
          title="Buscar (Ctrl+K)"
        >
          <IconSearch className="size-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Buscar…</span>
              <kbd className="kbd">⌘K</kbd>
            </>
          )}
        </button>
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV_SECTIONS.map((section) => {
          const sectionItems = items.filter((i) => i.section === section.id)
          if (sectionItems.length === 0) return null
          return (
            <div key={section.id} className="mb-4 last:mb-0">
              {!collapsed ? (
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
                  {section.label}
                </p>
              ) : (
                <div className="mx-auto mb-2 h-px w-6 bg-sidebar-border" aria-hidden />
              )}
              <ul className="space-y-0.5">
                {sectionItems.map((item) => {
                  const active = item.isActive(pathname)
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          'group relative flex items-center gap-3 rounded-lg text-sm font-medium transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          collapsed ? 'size-10 justify-center mx-auto' : 'h-10 px-3',
                          active
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                            : 'text-sidebar-foreground hover:bg-muted hover:text-foreground'
                        )}
                      >
                        {active && !collapsed && (
                          <span
                            aria-hidden
                            className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary"
                          />
                        )}
                        <NavIcon
                          id={item.icon}
                          className={cn(
                            'size-5 shrink-0 transition-colors',
                            active ? 'text-primary' : 'text-sidebar-muted group-hover:text-foreground'
                          )}
                        />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      {/* Usuario */}
      <div className="shrink-0 border-t border-sidebar-border p-2">
        <div
          className={cn(
            'flex items-center gap-3 rounded-lg',
            collapsed ? 'flex-col py-1' : 'px-2 py-1.5'
          )}
        >
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-foreground"
            title={nombre ?? email ?? undefined}
          >
            {iniciales(nombre, email)}
          </span>
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium text-foreground">{nombre ?? email ?? 'Usuario'}</p>
              {rol && <p className="truncate text-xs text-sidebar-muted">{etiquetaRol(rol)}</p>}
            </div>
          )}
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex size-9 items-center justify-center rounded-md text-sidebar-muted hover:bg-danger-soft hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <IconSalir className="size-[18px]" />
            </button>
          </form>
        </div>
        {collapsed && (
          <button
            type="button"
            onClick={toggle}
            className="mt-1 flex h-9 w-full items-center justify-center rounded-md text-sidebar-muted hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Expandir menú"
            title="Expandir menú (Ctrl+B)"
          >
            <IconPanelLeft className="size-[18px] rotate-180" />
          </button>
        )}
      </div>
    </aside>
  )
}
