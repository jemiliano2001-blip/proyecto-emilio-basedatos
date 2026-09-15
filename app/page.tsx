import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  IconChevron,
  IconPlus,
  IconSolicitudes,
  IconRecepcion,
  IconProyectos,
} from '@/components/icons'
import { PageHeader } from '@/components/PageHeader'
import { getSessionUsuario } from '@/lib/auth/session'
import {
  homePathForRol,
  puedeCapturarRecepcion,
  puedeCrearSolicitudes,
  puedeGestionarObras,
  puedeVerPrecios,
} from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { HomeProjectsWorkbench } from '@/components/HomeProjectsWorkbench'
import type { Obra } from '@/lib/types'

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estatus?: string }>
}) {
  const initialFilters = await searchParams
  const session = await getSessionUsuario()
  const landing = homePathForRol(session?.rol ?? null)
  if (landing !== '/') {
    redirect(landing)
  }

  const supabase = await createClient()
  const puedeCrear = puedeGestionarObras(session?.rol ?? null)
  const puedeSolicitar = puedeCrearSolicitudes(session?.rol ?? null)
  const puedeRecibir = puedeCapturarRecepcion(session?.rol ?? null)
  const puedeConsultarOrdenes = puedeVerPrecios(session?.rol ?? null)

  // Consulta defensiva de obras incluyendo foto_url si ya existe en schema
  let obras: Pick<
    Obra,
    'id' | 'nombre' | 'ciudad' | 'fraccionamiento' | 'cliente' | 'estado' | 'foto_url'
  >[] = []
  let obrasLoadError = false

  const { data: obrasData, error: obrasError } = await supabase
    .from('obras')
    .select('id, nombre, ciudad, fraccionamiento, cliente, estado, foto_url')
    .order('nombre')

  if (obrasError) {
    // Fallback defensivo si la columna foto_url aún no se aplica en BD remota
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('obras')
      .select('id, nombre, ciudad, fraccionamiento, cliente, estado')
      .order('nombre')
    obras = (fallbackData ?? []).map((o) => ({ ...o, foto_url: null }))
    obrasLoadError = Boolean(fallbackError)
  } else {
    obras = obrasData ?? []
  }

  // Contadores operativos en paralelo
  const [reqResult, recResult] = await Promise.allSettled([
    supabase
      .from('solicitudes_material')
      .select('id', { count: 'exact', head: true })
      .in('estado', ['recibida', 'en_proceso']),
    supabase
      .from('recepciones_material')
      .select('id', { count: 'exact', head: true }),
  ])

  const requisicionesPendientes =
    reqResult.status === 'fulfilled' && !reqResult.value.error ? reqResult.value.count ?? 0 : null
  const totalRecepciones =
    recResult.status === 'fulfilled' && !recResult.value.error ? recResult.value.count ?? 0 : null
  const proyectosActivos = obras.filter((o) => o.estado === 'activa').length

  return (
    <main className="page-shell space-y-6">
      <PageHeader
        title="Panel Operativo"
        subtitle={
          session?.perfil?.nombre
            ? `Bienvenido, ${session.perfil.nombre}`
            : 'Trazabilidad y control de materiales'
        }
      />

      {/* Una sola primary dominante; secundarias outline */}
      <section className="space-y-2.5">
        <Link
          href={
            puedeSolicitar
              ? '/solicitudes/nueva'
              : puedeConsultarOrdenes
                ? '/ordenes'
                : '/solicitudes'
          }
          className="btn-primary w-full justify-between gap-3 px-4 shadow-sm group"
        >
          <span className="inline-flex items-center gap-2.5 min-w-0">
            <IconSolicitudes className="w-5 h-5 shrink-0 text-teal-300" />
            <span className="text-left min-w-0">
              <span className="block font-bold leading-tight">
                {puedeSolicitar
                  ? 'Nueva requisición'
                  : puedeConsultarOrdenes
                    ? 'Órdenes de compra'
                    : 'Ver solicitudes'}
              </span>
              <span className="block text-xs font-medium text-white/70 mt-0.5">
                {puedeSolicitar
                  ? 'Solicitar materiales o servicios'
                  : 'Abrir trabajo pendiente'}
              </span>
            </span>
          </span>
          <IconChevron className="w-4 h-4 shrink-0 opacity-70 group-hover:translate-x-0.5 transition-transform" />
        </Link>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Link
            href={puedeRecibir ? '/recepciones' : '/materiales'}
            className="btn-secondary w-full justify-between gap-2 text-sm"
          >
            <span className="inline-flex items-center gap-2 min-w-0">
              <IconRecepcion className="w-4 h-4 shrink-0 text-accent" />
              <span className="truncate">
                {puedeRecibir ? 'Recibir material' : 'Consultar materiales'}
              </span>
            </span>
            <IconChevron className="w-4 h-4 shrink-0 text-gray-400" />
          </Link>

          {puedeCrear ? (
            <Link
              href="/obras/nueva"
              className="btn-secondary w-full justify-between gap-2 text-sm"
            >
              <span className="inline-flex items-center gap-2 min-w-0">
                <IconPlus className="w-4 h-4 shrink-0 text-accent" />
                <span className="truncate">Nuevo proyecto</span>
              </span>
              <IconChevron className="w-4 h-4 shrink-0 text-gray-400" />
            </Link>
          ) : (
            <Link
              href="/materiales"
              className="btn-secondary w-full justify-between gap-2 text-sm"
            >
              <span className="inline-flex items-center gap-2 min-w-0">
                <IconProyectos className="w-4 h-4 shrink-0 text-accent" />
                <span className="truncate">Catálogo materiales</span>
              </span>
              <IconChevron className="w-4 h-4 shrink-0 text-gray-400" />
            </Link>
          )}
        </div>
      </section>

      {/* KPIs compactos — no compiten con el CTA */}
      <section className="grid grid-cols-3 gap-2 rounded-xl border border-gray-200 bg-white p-2 sm:p-2.5">
        <div className="px-1.5 py-1 sm:px-2 text-center sm:text-left">
          <span className="block text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Activos
          </span>
          <p className="text-lg sm:text-xl font-black text-ink tabular-nums leading-tight mt-0.5">
            {proyectosActivos}
          </p>
        </div>

        <Link
          href="/solicitudes"
          className="px-1.5 py-1 sm:px-2 text-center sm:text-left rounded-lg hover:bg-teal-50/60 transition-colors"
        >
          <span className="block text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-teal-800">
            Requisiciones
          </span>
          <p className="text-lg sm:text-xl font-black text-teal-900 tabular-nums leading-tight mt-0.5">
            {requisicionesPendientes ?? '—'}
          </p>
        </Link>

        <Link
          href="/recepciones"
          className="px-1.5 py-1 sm:px-2 text-center sm:text-left rounded-lg hover:bg-slate-50 transition-colors"
        >
          <span className="block text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Recepciones
          </span>
          <p className="text-lg sm:text-xl font-black text-ink tabular-nums leading-tight mt-0.5">
            {totalRecepciones ?? '—'}
          </p>
        </Link>
      </section>

      {(requisicionesPendientes === null || totalRecepciones === null) && (
        <p className="-mt-4 text-sm text-warn" role="status">
          Algunas métricas no están disponibles por el momento. Los accesos operativos siguen funcionando.
        </p>
      )}
      {obrasLoadError && (
        <p className="-mt-4 text-sm text-red-700" role="alert">
          No se pudo cargar la lista de proyectos. Revisa la conexión e intenta de nuevo.
        </p>
      )}

      {/* Workbench de Proyectos: Búsqueda, Filtros y Lista con Miniaturas */}
      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-gray-200 pb-2">
          <h2 className="text-base font-bold text-ink">Proyectos</h2>
          <span className="text-xs text-gray-400 font-medium">
            {obras.length} registrado{obras.length === 1 ? '' : 's'}
          </span>
        </div>

      <HomeProjectsWorkbench
        obras={obras}
        puedeCrear={puedeCrear}
        initialSearch={initialFilters.q ?? ''}
        initialStatus={initialFilters.estatus}
      />
      </section>
    </main>
  )
}
