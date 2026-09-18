import Link from 'next/link'
import { redirect } from 'next/navigation'
import { IconMateriales, IconPlus, IconRecepcion, IconSolicitudes } from '@/components/icons'
import { PageHeader } from '@/components/PageHeader'
import { getSessionUsuario } from '@/lib/auth/session'
import {
  homePathForRol,
  puedeCapturarRecepcion,
  puedeCrearSolicitudes,
  puedeGestionarObras,
  puedeVerPrecios,
} from '@/lib/roles'
import { formatMoneyMx } from '@/lib/money'
import { createClient } from '@/lib/supabase/server'
import { HomeProjectsWorkbench } from '@/components/HomeProjectsWorkbench'
import type { Obra } from '@/lib/types'
import { cn } from '@/lib/utils'

type ObraHome = Pick<
  Obra,
  'id' | 'nombre' | 'ciudad' | 'fraccionamiento' | 'cliente' | 'estado' | 'foto_url' | 'presupuesto_mxn'
>

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
  const rol = session?.rol ?? null
  const puedeCrear = puedeGestionarObras(rol)
  const puedeSolicitar = puedeCrearSolicitudes(rol)
  const puedeRecibir = puedeCapturarRecepcion(rol)
  const verDinero = puedeVerPrecios(rol)

  // Consulta defensiva de obras incluyendo foto_url si ya existe en schema
  let obras: ObraHome[] = []
  let obrasLoadError = false

  const { data: obrasData, error: obrasError } = await supabase
    .from('obras')
    .select('id, nombre, ciudad, fraccionamiento, cliente, estado, foto_url, presupuesto_mxn')
    .order('nombre')

  if (obrasError) {
    // Fallback defensivo si la columna foto_url aún no se aplica en BD remota
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('obras')
      .select('id, nombre, ciudad, fraccionamiento, cliente, estado, presupuesto_mxn')
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
  const activas = obras.filter((o) => o.estado === 'activa')
  const presupuestoActivo = activas.reduce((acc, o) => acc + Number(o.presupuesto_mxn ?? 0), 0)

  const kpis: {
    label: string
    value: string
    hint: string
    href?: string
    alerta?: boolean
  }[] = [
    {
      label: 'Proyectos activos',
      value: String(activas.length),
      hint: `${obras.length} registrado${obras.length === 1 ? '' : 's'} en total`,
    },
    {
      label: 'Requisiciones pendientes',
      value: requisicionesPendientes === null ? '—' : String(requisicionesPendientes),
      hint: 'En cola de Compras o Finanzas',
      href: '/solicitudes',
      alerta: Boolean(requisicionesPendientes),
    },
    {
      label: 'Recepciones',
      value: totalRecepciones === null ? '—' : String(totalRecepciones),
      hint: 'Checklists capturados en obra',
      href: '/recepciones',
    },
  ]
  if (verDinero) {
    kpis.push({
      label: 'Presupuesto activo',
      value: formatMoneyMx(presupuestoActivo),
      hint: 'Suma de topes de proyectos activos',
    })
  }

  return (
    <main className="page-shell-wide space-y-6">
      <PageHeader
        title="Panel operativo"
        actions={
          <>
            {puedeCrear && (
              <Link href="/obras/nueva" className="btn-secondary btn-sm">
                <IconPlus className="size-4" />
                Nuevo proyecto
              </Link>
            )}
            {puedeSolicitar ? (
              <Link href="/solicitudes/nueva" className="btn-primary btn-sm">
                <IconSolicitudes className="size-4" />
                Nueva requisición
              </Link>
            ) : verDinero ? (
              <Link href="/ordenes" className="btn-primary btn-sm">
                Órdenes de compra
              </Link>
            ) : null}
          </>
        }
      />

      {/* KPIs */}
      <section
        aria-label="Indicadores"
        className={cn(
          'grid grid-cols-2 gap-3',
          kpis.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
        )}
      >
        {kpis.map((kpi) => {
          const content = (
            <>
              <span className="stat-label">{kpi.label}</span>
              <p className={cn('stat-value mt-1 text-xl sm:text-2xl', kpi.alerta && 'text-warning-soft-foreground')}>
                {kpi.value}
              </p>
              <p className="text-xs text-muted-foreground">{kpi.hint}</p>
            </>
          )
          return kpi.href ? (
            <Link
              key={kpi.label}
              href={kpi.href}
              className="stat-tile transition-colors hover:border-input hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {content}
            </Link>
          ) : (
            <div key={kpi.label} className="stat-tile">
              {content}
            </div>
          )
        })}
      </section>

      {(requisicionesPendientes === null || totalRecepciones === null) && (
        <p className="text-sm text-warning-soft-foreground" role="status">
          Algunas métricas no están disponibles por el momento. Los accesos operativos siguen funcionando.
        </p>
      )}
      {obrasLoadError && (
        <p className="text-sm text-danger" role="alert">
          No se pudo cargar la lista de proyectos. Revisa la conexión e intenta de nuevo.
        </p>
      )}

      {/* Accesos rápidos: en desktop ya están en el sidebar */}
      <section aria-label="Accesos rápidos" className="flex flex-wrap gap-2 lg:hidden">
        {puedeRecibir && (
          <Link href="/recepciones" className="btn-secondary btn-sm">
            <IconRecepcion className="size-4" />
            Recibir material
          </Link>
        )}
        {rol !== 'personal' && (
          <Link href="/materiales" className="btn-secondary btn-sm">
            <IconMateriales className="size-4" />
            Catálogo de materiales
          </Link>
        )}
        {verDinero && (
          <Link href="/ordenes" className="btn-secondary btn-sm">
            Órdenes de compra
          </Link>
        )}
      </section>

      {/* Proyectos */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Proyectos</h2>
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
