'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  IconChevron,
  IconDocumento,
  IconProyectos,
  IconSearch,
  IconCerrar,
} from '@/components/icons'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import type { Obra } from '@/lib/types'

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
      // Filtro por estatus
      if (selectedTab !== 'todas' && obra.estado !== selectedTab) {
        return false
      }

      // Filtro por búsqueda textual
      if (!search.trim()) return true
      const q = search.toLowerCase()
      const matchNombre = obra.nombre.toLowerCase().includes(q)
      const matchCliente = obra.cliente?.toLowerCase().includes(q) ?? false
      const matchCiudad = obra.ciudad?.toLowerCase().includes(q) ?? false
      const matchFracc = obra.fraccionamiento?.toLowerCase().includes(q) ?? false

      return matchNombre || matchCliente || matchCiudad || matchFracc
    })
  }, [obras, selectedTab, search])

  const counts = useMemo(() => {
    return {
      todas: obras.length,
      activa: obras.filter((o) => o.estado === 'activa').length,
      pausada: obras.filter((o) => o.estado === 'pausada').length,
      cerrada: obras.filter((o) => o.estado === 'cerrada').length,
    }
  }, [obras])

  return (
    <div className="space-y-4">
      {/* Barra de control: Búsqueda y Filtro de estatus */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Buscador reactivo */}
        <div className="relative flex-1">
          <input
            aria-label="Buscar proyectos"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, cliente, ciudad..."
            className="input-base text-base pl-11 pr-11"
          />
          <IconSearch className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-0 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-ink"
              aria-label="Limpiar búsqueda"
            >
              <IconCerrar className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Pestañas de estatus */}
        <div className="flex items-center gap-1.5 p-1 bg-muted rounded-xl overflow-x-auto shrink-0" role="tablist" aria-label="Estatus del proyecto">
          <button
            type="button"
            onClick={() => setSelectedTab('activa')}
            role="tab" aria-selected={selectedTab === 'activa'} className={`min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedTab === 'activa'
                ? 'bg-white text-navy font-bold shadow-sm'
                : 'text-gray-600 hover:text-ink'
            }`}
          >
            Activos <span className="text-[11px] opacity-75">({counts.activa})</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab('pausada')}
            role="tab" aria-selected={selectedTab === 'pausada'} className={`min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedTab === 'pausada'
                ? 'bg-white text-navy font-bold shadow-sm'
                : 'text-gray-600 hover:text-ink'
            }`}
          >
            Pausados <span className="text-[11px] opacity-75">({counts.pausada})</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab('cerrada')}
            role="tab" aria-selected={selectedTab === 'cerrada'} className={`min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedTab === 'cerrada'
                ? 'bg-white text-navy font-bold shadow-sm'
                : 'text-gray-600 hover:text-ink'
            }`}
          >
            Cerrados <span className="text-[11px] opacity-75">({counts.cerrada})</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab('todas')}
            role="tab" aria-selected={selectedTab === 'todas'} className={`min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedTab === 'todas'
                ? 'bg-white text-navy font-bold shadow-sm'
                : 'text-gray-600 hover:text-ink'
            }`}
          >
            Todos <span className="text-[11px] opacity-75">({counts.todas})</span>
          </button>
        </div>
      </div>

      {/* Lista de Proyectos */}
      <div className="space-y-2.5">
        {filteredObras.map((obra) => {
          const subtitulo = [obra.cliente, obra.ciudad, obra.fraccionamiento]
            .filter(Boolean)
            .join(' · ')

          return (
            <Link
              key={obra.id}
              href={`/obras/${obra.id}`}
              className="card-interactive flex items-center gap-3.5 p-3 sm:p-4 group"
            >
              {/* Miniatura de foto de proyecto o ícono insignia */}
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden bg-slate-100 border border-gray-200 shrink-0 flex items-center justify-center relative">
                {obra.foto_url ? (
                  <Image
                    src={obra.foto_url}
                    alt={obra.nombre}
                    width={100}
                    height={100}
                    unoptimized
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200 text-slate-400 group-hover:text-teal-800 transition-colors">
                    <IconProyectos className="w-6 h-6 opacity-70" />
                  </div>
                )}
              </div>

              {/* Información textual */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-ink text-sm sm:text-base truncate group-hover:text-navy transition-colors">
                    {obra.nombre}
                  </h3>
                  <Badge
                    variant={
                      obra.estado === 'activa'
                        ? 'teal'
                        : obra.estado === 'pausada'
                          ? 'amber'
                          : 'gray'
                    }
                  >
                    {obra.estado === 'activa'
                      ? 'Activo'
                      : obra.estado === 'pausada'
                        ? 'Pausado'
                        : 'Cerrado'}
                  </Badge>
                </div>

                {subtitulo && (
                  <p className="text-xs sm:text-sm text-gray-500 truncate mt-0.5">
                    {subtitulo}
                  </p>
                )}
              </div>

              <div className="shrink-0 flex items-center gap-1 text-gray-400 group-hover:text-teal-800 transition-colors">
                <span className="hidden sm:inline text-xs font-semibold">Ver proyecto</span>
                <IconChevron className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          )
        })}

        {filteredObras.length === 0 && (
          <EmptyState
            icon={<IconDocumento className="w-8 h-8" />}
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
                ? 'Prueba modificando el término de búsqueda o seleccionando otra pestaña de estatus.'
                : puedeCrear && selectedTab === 'activa'
                  ? 'Comienza registrando tu primer proyecto para gestionar su presupuesto y materiales.'
                  : undefined
            }
            action={
              search
                ? {
                    label: 'Limpiar búsqueda',
                    href: '#',
                    onClick: () => setSearch(''),
                  }
                : puedeCrear && selectedTab === 'activa'
                  ? { label: 'Nuevo proyecto', href: '/obras/nueva' }
                  : undefined
            }
          />
        )}
      </div>
    </div>
  )
}
