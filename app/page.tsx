import Link from 'next/link'
import { IconChevron } from '@/components/icons'
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
    .select('id, nombre, fraccionamiento, cliente, estado')
    .eq('estado', estatus)
    .order('nombre')

  const tabClass = (activo: boolean) =>
    `min-h-[44px] flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold ${
      activo ? 'bg-ink text-white' : 'bg-white text-ink border border-gray-200'
    }`

  return (
    <main className="page-shell">
      <header className="mb-4 flex items-start justify-between gap-3 pt-2">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            {estatus === 'activa'
              ? 'Proyectos activos'
              : estatus === 'pausada'
                ? 'Proyectos pausados'
                : 'Proyectos cerrados'}
          </h1>
          <p className="text-sm text-gray-500">
            {session?.perfil?.nombre
              ? `Hola, ${session.perfil.nombre}`
              : 'Materiales y proyectos'}
          </p>
        </div>
        {puedeCrear && (
          <Link href="/obras/nueva" className="btn-primary shrink-0 px-4 py-2 text-sm">
            Nuevo proyecto
          </Link>
        )}
      </header>

      <div className="mb-4 flex gap-2" role="tablist" aria-label="Estatus de proyectos">
        <Link href="/?estatus=activa" className={tabClass(estatus === 'activa')} scroll={false}>
          Activos
        </Link>
        <Link href="/?estatus=pausada" className={tabClass(estatus === 'pausada')} scroll={false}>
          Pausados
        </Link>
        <Link href="/?estatus=cerrada" className={tabClass(estatus === 'cerrada')} scroll={false}>
          Cerrados
        </Link>
      </div>

      {error && (
        <div className="card mb-4 border-red-300 bg-red-50 text-red-700">
          No se pudieron cargar los proyectos. Revisa tu conexión.
        </div>
      )}

      <div className="space-y-3">
        {(obras as Pick<Obra, 'id' | 'nombre' | 'fraccionamiento' | 'cliente' | 'estado'>[] | null)?.map(
          (obra) => (
            <Link
              key={obra.id}
              href={`/obras/${obra.id}`}
              className="card flex min-h-[44px] items-center justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold text-ink">{obra.nombre}</p>
                {(obra.cliente || obra.fraccionamiento) && (
                  <p className="text-sm text-gray-500">
                    {[obra.cliente, obra.fraccionamiento].filter(Boolean).join(' · ')}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-400">{labelEstatus(obra.estado)}</p>
              </div>
              <IconChevron className="h-5 w-5 shrink-0 text-accent" />
            </Link>
          )
        )}

        {obras?.length === 0 && (
          <p className="py-8 text-center text-gray-500">
            No hay proyectos {estatus === 'activa' ? 'activos' : estatus === 'pausada' ? 'pausados' : 'cerrados'} todavía.
          </p>
        )}
      </div>
    </main>
  )
}
