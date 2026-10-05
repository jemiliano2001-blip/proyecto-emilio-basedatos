'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { IconChevron, IconDocumento, IconProyectos, IconSearch, IconCerrar } from '@/components/icons'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import type { Obra } from '@/lib/types'
import { cn } from '@/lib/utils'

interface HomeProjectsWorkbenchProps {
  obras: Pick<
    Obra,
    'id' | 'nombre' | 'ciudad' | 'fraccionamiento' | 'cliente' | 'estado' | 'foto_url'
  >[]
  puedeCrear: boolean
  initialSearch?: string
  initialStatus?: string
}

type EstatusTab = 'todas' | 'activa' | 'pausada' | 'cerrada'

const TABS: { id: EstatusTab; label: string }[] = [
  { id: 'activa', label: 'Activos' },
  { id: 'pausada', label: 'Pausados' },
  { id: 'cerrada', label: 'Cerrados' },
  { id: 'todas', label: 'Todos' },
]

function estadoBadge(estado: string) {
  if (estado === 'activa') return { variant: 'success' as const, label: 'Activo' }
  if (estado === 'pausada') return { variant: 'warning' as const, label: 'Pausado' }
  return { variant: 'neutral' as const, label: 'Cerrado' }
}

export function HomeProjectsWorkbench({
  obras,
  puedeCrear,
  initialSearch = '',
  initialStatus,
}: HomeProjectsWorkbenchProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const initialTab: EstatusTab = ['todas', 'activa', 'pausada', 'cerrada'].includes(initialStatus ?? '')
    ? (initialStatus as EstatusTab)
    : 'activa'
  const [search, setSearch] = useState(initialSearch)
  const [selectedTab, setSelectedTab] = useState<EstatusTab>(initialTab)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (search.trim()) params.set('q', search.trim())
      else params.delete('q')
      if (selectedTab !== 'activa') params.set('estatus', selectedTab)
      else params.delete('estatus')
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }, 180)
    return () => window.clearTimeout(timer)
  }, [pathname, router, search, searchParams, selectedTab])

  const filteredObras = useMemo(() => {
    return obras.filter((obra) => {
      if (selectedTab !== 'todas' && obra.estado !== selectedTab) return false
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        obra.nombre.toLowerCase().includes(q) ||
        (obra.cliente?.toLowerCase().includes(q) ?? false) ||
        (obra.ciudad?.toLowerCase().includes(q) ?? false) ||
        (obra.fraccionamiento?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [obras, selectedTab, search])

  const counts = useMemo(
    () => ({
      todas: obras.length,
      activa: obras.filter((o) => o.estado === 'activa').length,
      pausada: obras.filter((o) => o.estado === 'pausada').length,
      cerrada: obras.filter((o) => o.estado === 'cerrada').length,
    }),
    [obras]
  )

  return (
    <div className="space-y-3">
      {/* Toolbar: búsqueda + segmentos de estatus */}
      <div className="sticky top-[calc(var(--topbar-height)+env(safe-area-inset-top,0px))] z-10 -mx-1 flex flex-col gap-2.5 bg-background/95 px-1 py-2 backdrop-blur-md sm:static sm:flex-row sm:items-center sm:justify-between sm:bg-transparent sm:py-0 sm:backdrop-blur-none">
        <div className="relative flex-1 sm:max-w-md">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            aria-label="Buscar proyectos"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, cliente, ciudad…"
            className="input-base pl-9 pr-10 sm:min-h-[40px] sm:py-2 sm:text-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-0 top-0 flex h-full w-10 items-center justify-center rounded-r-lg text-muted-foreground hover:text-foreground"
              aria-label="Limpiar búsqueda"
            >
              <IconCerrar className="size-4" />
            </button>
          )}
        </div>

        <div
          className="flex shrink-0 items-center gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1 border border-border/50 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Estatus del proyecto"
        >
          {TABS.map((tab) => {
            const active = selectedTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedTab(tab.id)}
                className={cn(
                  'inline-flex min-h-[38px] items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs sm:text-sm font-semibold transition-all sm:min-h-[34px]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring select-none',
                  active
                    ? 'bg-card text-foreground shadow-xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums transition-colors',
                    active ? 'bg-primary-soft text-primary' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {counts[tab.id]}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Lista */}
      {filteredObras.length > 0 ? (
        <div className="list-stack">
          <div className="list-header lg:grid-cols-[2.5rem_minmax(0,2fr)_minmax(0,1.2fr)_6.5rem_1.5rem]">
            <span />
            <span>Proyecto</span>
            <span>Cliente</span>
            <span>Estatus</span>
            <span />
          </div>
          {filteredObras.map((obra) => {
            const badge = estadoBadge(obra.estado)
            const ubicacion = [obra.ciudad, obra.fraccionamiento].filter(Boolean).join(' · ')
            return (
              <Link
                key={obra.id}
                href={`/obras/${obra.id}`}
                className="list-row group items-center lg:grid lg:grid-cols-[2.5rem_minmax(0,2fr)_minmax(0,1.2fr)_6.5rem_1.5rem] lg:gap-3"
              >
                <div className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/80 bg-muted/50 lg:size-10 shadow-2xs">
                  {obra.foto_url ? (
                    <Image
                      src={obra.foto_url}
                      alt=""
                      width={80}
                      height={80}
                      unoptimized
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center bg-primary-soft/50 text-primary">
                      <IconProyectos className="size-5" />
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-bold text-foreground group-hover:text-primary transition-colors font-sans">
                      {obra.nombre}
                    </p>
                    <span className="lg:hidden">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    <span className="lg:hidden">{[obra.cliente, ubicacion].filter(Boolean).join(' · ')}</span>
                    <span className="hidden lg:inline">{ubicacion || 'Sin ubicación'}</span>
                  </p>
                </div>

                <p className="hidden min-w-0 truncate text-sm text-muted-foreground lg:block">
                  {obra.cliente || '—'}
                </p>
                <div className="hidden lg:block">
                  <Badge variant={badge.variant} dot>
                    {badge.label}
                  </Badge>
                </div>

                <IconChevron className="size-5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary lg:size-4" />
              </Link>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={IconDocumento}
          title={
            search
              ? 'No se encontraron proyectos con ese criterio'
              : `No hay proyectos ${
                  selectedTab === 'activa'
                    ? 'activos'
                    : selectedTab === 'pausada'
                      ? 'pausados'
                      : selectedTab === 'cerrada'
                        ? 'cerrados'
                        : 'registrados'
                }`
          }
          description={
            search
              ? 'Prueba con otro término o cambia la pestaña de estatus.'
              : puedeCrear && selectedTab === 'activa'
                ? 'Registra tu primer proyecto para controlar su presupuesto y materiales.'
                : undefined
          }
          action={
            search
              ? { label: 'Limpiar búsqueda', onClick: () => setSearch('') }
              : puedeCrear && selectedTab === 'activa'
                ? { label: 'Nuevo proyecto', href: '/obras/nueva' }
                : undefined
          }
        />
      )}
    </div>
  )
}
