import Link from 'next/link'
import { IconChevron, IconPlus, IconDocumento } from '@/components/icons'
import { PageHeader } from '@/components/PageHeader'
import { FilterTabs } from '@/components/FilterTabs'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarObras } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { Obra } from '@/lib/types'

const ESTATUS = ['activa', 'pausada', 'cerrada'] as const
type EstatusFiltro = (typeof ESTATUS)[number]

function asEstatus(value: string | undefined): EstatusFiltro {
  if (value === 'pausada' || value === 'cerrada') return value
  return 'activa'
}

function labelEstatus(estado: Obra['estado']): string {
  if (estado === 'pausada') return 'Pausado'
  if (estado === 'cerrada') return 'Cerrado'
  return 'Activo'
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: { estatus?: string }
}) {
  const session = await getSessionUsuario()
  const supabase = createClient()
  const puedeCrear = puedeGestionarObras(session?.rol ?? null)
  const estatus = asEstatus(searchParams.estatus)

  const { data: obras, error } = await supabase
    .from('obras')
    .select('id, nombre, ciudad, fraccionamiento, cliente, estado')
    .eq('estado', estatus)
    .order('nombre')

  const tabs = [
    { key: 'activa', label: 'Activos', href: '/?estatus=activa', active: estatus === 'activa' },
    { key: 'pausada', label: 'Pausados', href: '/?estatus=pausada', active: estatus === 'pausada' },
    { key: 'cerrada', label: 'Cerrados', href: '/?estatus=cerrada', active: estatus === 'cerrada' },
  ]

  return (
    <main className="page-shell">
      <PageHeader
        title={
          estatus === 'activa'
            ? 'Proyectos activos'
            : estatus === 'pausada'
              ? 'Proyectos pausados'
              : 'Proyectos cerrados'
        }
        subtitle={
          session?.perfil?.nombre
            ? `Hola, ${session.perfil.nombre}`
            : 'Materiales y proyectos'
        }
        action={
          puedeCrear
            ? {
                label: 'Nuevo proyecto',
                href: '/obras/nueva',
                icon: <IconPlus className="w-4 h-4" />,
              }
            : undefined
        }
      />

      <FilterTabs tabs={tabs} className="mb-4" />

      {error && (
        <div className="card mb-4 border-red-300 bg-red-50 text-red-700">
          No se pudieron cargar los proyectos. Revisa tu conexión.
        </div>
      )}

      <div className="space-y-3">
        {(obras as Pick<Obra, 'id' | 'nombre' | 'ciudad' | 'fraccionamiento' | 'cliente' | 'estado'>[] | null)?.map(
          (obra) => (
            <Link
              key={obra.id}
              href={`/obras/${obra.id}`}
              className="card-interactive flex min-h-[48px] items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-ink truncate">{obra.nombre}</p>
                  <Badge
                    variant={
                      obra.estado === 'activa'
                        ? 'teal'
                        : obra.estado === 'pausada'
                          ? 'amber'
                          : 'gray'
                    }
                  >
                    {labelEstatus(obra.estado)}
                  </Badge>
                </div>
                {(obra.cliente || obra.ciudad || obra.fraccionamiento) && (
                  <p className="text-sm text-gray-500 truncate mt-0.5">
                    {[obra.cliente, obra.ciudad, obra.fraccionamiento].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <IconChevron className="h-5 w-5 shrink-0 text-accent transition-transform group-hover:translate-x-0.5" />
            </Link>
          )
        )}

        {obras?.length === 0 && (
          <EmptyState
            icon={<IconDocumento className="w-8 h-8" />}
            title={`No hay proyectos ${estatus === 'activa' ? 'activos' : estatus === 'pausada' ? 'pausados' : 'cerrados'}`}
            description={
              puedeCrear && estatus === 'activa'
                ? 'Comienza registrando tu primer proyecto para gestionar su presupuesto y materiales.'
                : undefined
            }
            action={
              puedeCrear && estatus === 'activa'
                ? { label: 'Nuevo proyecto', href: '/obras/nueva' }
                : undefined
            }
          />
        )}
      </div>
    </main>
  )
}
