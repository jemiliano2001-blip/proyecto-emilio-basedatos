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

  const { data: obrasData, error: obrasError } = await supabase
    .from('obras')
    .select('id, nombre, ciudad, fraccionamiento, cliente, estado, foto_url')
    .order('nombre')

  if (obrasError) {
    // Fallback defensivo si la columna foto_url aún no se aplica en BD remota
    const { data: fallbackData } = await supabase
      .from('obras')
      .select('id, nombre, ciudad, fraccionamiento, cliente, estado')
      .order('nombre')
    obras = (fallbackData ?? []).map((o) => ({ ...o, foto_url: null }))
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
      {/* Encabezado Principal */}
      <PageHeader
        title="Panel Operativo"
        subtitle={
          session?.perfil?.nombre
            ? `Bienvenido, ${session.perfil.nombre}`
            : 'Trazabilidad y control de materiales'
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

      {/* Barra de Acciones Rápidas (1-Click SaaS Quick Actions) */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <Link
          href={puedeSolicitar ? '/solicitudes/nueva' : puedeConsultarOrdenes ? '/ordenes' : '/solicitudes'}
          className="flex items-center justify-between p-3.5 rounded-xl bg-navy text-white hover:bg-slate-800 transition-colors shadow-sm group"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-white/10 text-teal-300">
              <IconSolicitudes className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm leading-none">{puedeSolicitar ? 'Nueva requisición' : puedeConsultarOrdenes ? 'Órdenes de compra' : 'Ver solicitudes'}</p>
              <p className="text-xs text-gray-300 mt-1">{puedeSolicitar ? 'Solicitar materiales o servicios' : 'Abrir trabajo pendiente'}</p>
            </div>
          </div>
          <IconChevron className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
        </Link>

        <Link
          href={puedeRecibir ? '/recepciones' : '/materiales'}
          className="flex items-center justify-between p-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors group"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-teal-50 text-teal-800 border border-teal-200/50">
              <IconRecepcion className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-ink leading-none">{puedeRecibir ? 'Recibir material' : 'Consultar materiales'}</p>
              <p className="text-xs text-gray-500 mt-1">{puedeRecibir ? 'Seleccionar una OC por recibir' : 'Existencias y especificaciones'}</p>
            </div>
          </div>
          <IconChevron className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
        </Link>

        {puedeCrear ? (
          <Link
            href="/obras/nueva"
            className="flex items-center justify-between p-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-800 border border-blue-200/50">
                <IconProyectos className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-ink leading-none">Nuevo Proyecto</p>
                <p className="text-[11px] text-gray-500 mt-1">Alta de obra y presupuesto</p>
              </div>
            </div>
            <IconChevron className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        ) : (
          <Link
            href="/materiales"
            className="flex items-center justify-between p-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-50 text-amber-800 border border-amber-200/50">
                <IconProyectos className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-ink leading-none">Catálogo Materiales</p>
                <p className="text-[11px] text-gray-500 mt-1">Consulta especificaciones</p>
              </div>
            </div>
            <IconChevron className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        )}
      </section>

      {/* Métricas Operativas (KPIs) */}
      <section className="grid grid-cols-3 gap-2.5">
        <div className="card p-3 sm:p-4 bg-gradient-to-br from-white to-slate-50 border-gray-200">
          <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500">
            Proyectos activos
          </span>
          <p className="text-xl sm:text-2xl font-black text-ink mt-1 tabular-nums">
            {proyectosActivos}
          </p>
        </div>

        <Link
          href="/solicitudes"
          className="card-interactive p-3 sm:p-4 bg-gradient-to-br from-white to-teal-50/20 border-teal-100 block"
        >
          <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-teal-800">
            Requisiciones
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl sm:text-2xl font-black text-teal-900 tabular-nums">
              {requisicionesPendientes ?? '—'}
            </span>
            <span className="text-[11px] text-teal-700 font-medium hidden sm:inline">
              en proceso
            </span>
          </div>
        </Link>

        <Link
          href="/recepciones"
          className="card-interactive p-3 sm:p-4 bg-gradient-to-br from-white to-slate-50 border-gray-200 block"
        >
          <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500">
            Recepciones
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl sm:text-2xl font-black text-ink tabular-nums">
              {totalRecepciones ?? '—'}
            </span>
            <span className="text-[11px] text-gray-400 font-medium hidden sm:inline">
              registradas
            </span>
          </div>
        </Link>
      </section>

      {(requisicionesPendientes === null || totalRecepciones === null) && (
        <p className="-mt-4 text-sm text-warn" role="status">
          Algunas métricas no están disponibles por el momento. Los accesos operativos siguen funcionando.
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
