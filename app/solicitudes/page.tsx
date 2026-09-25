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
import { IconPlus } from '@/components/icons'
import { OfflineQueueBanner } from '@/components/OfflineQueueBanner'
import { SolicitudesListClient } from '@/components/SolicitudesListClient'
import { getSessionUsuario } from '@/lib/auth/session'
import {
  puedeAprobarCompras,
  puedeAprobarPago,
  puedeCrearSolicitudes,
  puedeVerTodasLasSolicitudes,
} from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { EstadoSolicitud } from '@/lib/types'
import { cn } from '@/lib/utils'

interface SolicitudRow {
  id: string
  estado: EstadoSolicitud
  creado_en: string
  obra: { nombre: string; fraccionamiento: string | null } | null
  solicitante: { nombre: string } | null
  items: { id: string; obra_id: string | null }[]
  ordenes: { id: string; folio: string }[] | null
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
  if (!verTodas && session?.perfil?.id) query = query.eq('solicitante_id', session.perfil.id)
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
        title={verTodas ? 'Control de solicitudes de compra' : 'Mis solicitudes de compra'}
        subtitle={
          verTodas
            ? 'Requisiciones por estatus · Compras → Finanzas'
            : 'Estatus de lo que has solicitado'
        }
        action={
          puedeCrear
            ? {
                label: 'Nueva requisición',
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
        <div className="card mb-4 border-danger/40 bg-danger-soft text-danger-soft-foreground">
          No se pudieron cargar las solicitudes. Revisa tu conexión.
        </div>
      )}

      {(esCompras || esFinanzas) && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
            Colas operativas
          </span>
          <div className="overflow-x-auto rounded-lg bg-muted p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex shrink-0 items-center gap-0.5">
              {esCompras && (
                <Link
                  href="/solicitudes?estatus=recibida"
                  className={cn(
                    'inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 text-xs sm:text-sm font-medium transition-all select-none',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    filters.estatus === 'recibida'
                      ? 'bg-card text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-card/40'
                  )}
                >
                  Pendientes de Compras
                </Link>
              )}
              {(esFinanzas || esCompras) && (
                <Link
                  href="/solicitudes?estatus=en_proceso"
                  className={cn(
                    'inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 text-xs sm:text-sm font-medium transition-all select-none',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    filters.estatus === 'en_proceso'
                      ? 'bg-card text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-card/40'
                  )}
                >
                  Pendientes de Finanzas
                </Link>
              )}
              <Link
                href="/solicitudes"
                className={cn(
                  'inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 text-xs sm:text-sm font-medium transition-all select-none',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  !filters.estatus
                    ? 'bg-card text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-card/40'
                )}
              >
                Ver todas
              </Link>
            </div>
          </div>
        </div>
      )}
      <SolicitudesListClient
        solicitudes={lista}
        puedeCrear={puedeCrear}
        verTodas={verTodas}
        esCompras={esCompras}
        esFinanzas={esFinanzas}
      />
      {!error && (
        <ListPagination path="/solicitudes" params={params} page={filters.page} total={count ?? 0} />
      )}
    </main>
  )
}
