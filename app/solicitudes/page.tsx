import { ListFilters, ListPagination } from '@/components/ListFilters'
import { listFilters, type ListParams } from '@/lib/list-filters'
const STATUSES = [
  'recibida',
  'en_proceso',
  'finalizada',
  'pendiente',
  'en_cotizacion',
  'aprobada',
  'rechazada',
  'cancelada',
] as const
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { IconPlus, IconDocumento } from '@/components/icons'
import { OfflineQueueBanner } from '@/components/OfflineQueueBanner'
import { getSessionUsuario } from '@/lib/auth/session'
import {
  puedeAprobarCompras,
  puedeAprobarPago,
  puedeCrearSolicitudes,
  puedeVerTodasLasSolicitudes,
} from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { EstadoSolicitud } from '@/lib/types'

interface SolicitudRow {
  id: string
  estado: EstadoSolicitud
  creado_en: string
  obra: { nombre: string; fraccionamiento: string | null } | null
  solicitante: { nombre: string } | null
  items: { id: string; obra_id: string | null }[]
  ordenes: { id: string; folio: string }[] | null
}

function badgeVariant(estado: EstadoSolicitud): 'red' | 'teal' | 'navy' | 'amber' {
  switch (estado) {
    case 'cancelada':
    case 'rechazada':
      return 'red'
    case 'finalizada':
    case 'aprobada':
      return 'teal'
    case 'en_proceso':
    case 'en_cotizacion':
      return 'navy'
    case 'recibida':
    case 'pendiente':
    default:
      return 'amber'
  }
}

function labelEstado(estado: EstadoSolicitud) {
  switch (estado) {
    case 'recibida':
      return 'recibida'
    case 'en_proceso':
      return 'en proceso'
    case 'finalizada':
      return 'finalizada'
    case 'en_cotizacion':
      return 'en cotización'
    case 'pendiente':
      return 'recibida'
    case 'aprobada':
      return 'finalizada'
    default:
      return estado
  }
}

function esMultiObra(s: SolicitudRow): boolean {
  return (s.items ?? []).some((i) => i.obra_id !== null)
}

function labelMateriales(n: number): string {
  return n === 1 ? '1 material' : `${n} materiales`
}

export default async function SolicitudesPage({
  searchParams,
}: {
  searchParams: Promise<ListParams>
}) {
  const params = await searchParams
  const session = await getSessionUsuario()
  const rol = session?.rol ?? null
  const puedeCrear = puedeCrearSolicitudes(rol)
  const verTodas = puedeVerTodasLasSolicitudes(rol)
  const esCompras = puedeAprobarCompras(rol)
  const esFinanzas = puedeAprobarPago(rol)
  const colaComprasOnly = rol === 'compras'
  const colaFinanzasOnly = rol === 'finanzas'
  const colaOperativa = colaComprasOnly || colaFinanzasOnly

  // Default: solo pendientes de la cola del rol (sin filtro de estatus en UI)
  if (colaOperativa && !params.estatus) {
    redirect(
      colaComprasOnly ? '/solicitudes?estatus=recibida' : '/solicitudes?estatus=en_proceso'
    )
  }

  const filters = listFilters(params, STATUSES)
  const supabase = await createClient()

  const { data: obrasData } = await supabase.from('obras').select('id, nombre').order('nombre')
  const obras = obrasData ?? []

  let query = supabase
    .from('solicitudes_material')
    .select(
      'id, estado, creado_en, obra:obras!inner(nombre, fraccionamiento), solicitante:usuarios(nombre), items:solicitud_items(id, obra_id), ordenes:ordenes_compra(id, folio)',
      { count: 'exact' }
    )
    .order('creado_en', { ascending: false })
    .order('id', { ascending: false })
  if (filters.obra) query = query.eq('obra_id', filters.obra)
  if (filters.estatus === 'recibida') query = query.in('estado', ['recibida', 'pendiente'])
  else if (filters.estatus) query = query.eq('estado', filters.estatus)
  if (filters.desde) query = query.gte('creado_en', filters.desde + 'T00:00:00Z')
  if (filters.hasta)
    query = query.lt(
      'creado_en',
      new Date(Date.parse(filters.hasta) + 86400000).toISOString()
    )
  if (filters.q) query = query.ilike('obra.nombre', '%' + filters.q + '%')

  const { data: solicitudes, error, count } = await query.range(filters.from, filters.to)

  const lista = (solicitudes as unknown as SolicitudRow[] | null) ?? []

  return (
    <main className="page-shell">
      <PageHeader
        title={verTodas ? 'Control de solicitudes' : 'Mis solicitudes'}
        subtitle={
          verTodas
            ? 'Requisiciones por estatus · Compras → Finanzas'
            : 'Estatus de lo que has solicitado'
        }
        action={
          puedeCrear
            ? {
                label: 'Nueva',
                href: '/solicitudes/nueva',
                icon: <IconPlus className="w-4 h-4" />,
              }
            : undefined
        }
      />

      <OfflineQueueBanner />

      <ListFilters
        path="/solicitudes"
        params={params}
        statuses={STATUSES}
        searchLabel="Proyecto principal"
        obras={obras}
        hideEstatus={colaOperativa}
        estatusAsChips={!colaOperativa}
        compact
      />
      {error && (
        <div className="card mb-4 border-red-300 bg-red-50 text-red-700">
          No se pudieron cargar las solicitudes. Revisa tu conexión.
        </div>
      )}

      {(esCompras || esFinanzas) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {esCompras && (
            <Link
              href="/solicitudes?estatus=recibida"
              className={
                filters.estatus === 'recibida' ? 'btn-primary text-sm' : 'btn-secondary text-sm'
              }
            >
              Pendientes de Compras
            </Link>
          )}
          {(esFinanzas || esCompras) && (
            <Link
              href="/solicitudes?estatus=en_proceso"
              className={
                filters.estatus === 'en_proceso' ? 'btn-primary text-sm' : 'btn-secondary text-sm'
              }
            >
              Pendientes de Finanzas
            </Link>
          )}
        </div>
      )}
      <div className="space-y-2 md:space-y-0 md:rounded-xl md:border md:border-gray-200 md:bg-white md:divide-y md:divide-gray-100 md:overflow-hidden">
        {lista.map((s) => {
          const reqCode = `REQ-${s.id.slice(0, 8).toUpperCase()}`
          const ordenes = (s.ordenes ?? []) as { id: string; folio: string }[]
          return (
            <Link
              key={s.id}
              href={`/solicitudes/${s.id}`}
              className="card-interactive block min-h-[72px] md:rounded-none md:border-0 md:shadow-none md:hover:bg-slate-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-navy border border-slate-200/70">
                      {reqCode}
                    </span>
                    {ordenes.map((oc) => (
                      <span
                        key={oc.id}
                        className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200"
                      >
                        {oc.folio}
                      </span>
                    ))}
                  </div>
                  <p className="font-semibold text-ink truncate">
                    {s.obra?.nombre ?? 'Proyecto'}
                  </p>
                  <p className="mt-1 text-xs sm:text-sm text-gray-500 truncate">
                    {labelMateriales(s.items.length)}
                    {esMultiObra(s) ? ' · varios proyectos' : ''}
                    {verTodas && s.solicitante?.nombre ? ` · ${s.solicitante.nombre}` : ''}
                    {' · '}
                    {new Date(s.creado_en).toLocaleString('es-MX', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
                <Badge variant={badgeVariant(s.estado)}>{labelEstado(s.estado)}</Badge>
              </div>
            </Link>
          )
        })}

        {!error && lista.length === 0 && (
          <EmptyState
            icon={IconDocumento}
            title="Sin resultados"
            description={
              verTodas
                ? 'Todavía no hay requisiciones registradas en el sistema.'
                : 'Todavía no has levantado ninguna requisición.'
            }
            action={
              puedeCrear
                ? {
                    label: 'Nueva requisición',
                    href: '/solicitudes/nueva',
                  }
                : undefined
            }
          />
        )}
      </div>
      {!error && (
        <ListPagination path="/solicitudes" params={params} page={filters.page} total={count ?? 0} />
      )}
    </main>
  )
}
