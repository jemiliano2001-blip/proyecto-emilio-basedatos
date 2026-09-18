import { ListFilters, ListPagination } from '@/components/ListFilters'
import { listFilters, type ListParams } from '@/lib/list-filters'
const STATUSES = ['emitida', 'parcialmente_recibida', 'recibida', 'cancelada'] as const
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { IconDocumento } from '@/components/icons'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeVerPrecios } from '@/lib/roles'
import { formatMoneyMx } from '@/lib/money'
import { createClient } from '@/lib/supabase/server'

interface OrdenRow {
  id: string
  folio: string
  folio_fisico?: string | null
  total: number
  moneda: string
  estado: string
  creado_en: string
  obra: { nombre: string } | null
  proveedor: { nombre: string } | null
  facturas?: { id: string }[] | null
}

export default async function OrdenesPage({
  searchParams,
}: {
  searchParams: Promise<ListParams>
}) {
  const params = await searchParams
  const filters = listFilters(params, STATUSES)
  const session = await getSessionUsuario()
  if (!session || !puedeVerPrecios(session.rol)) {
    redirect('/')
  }

  const supabase = await createClient()
  const selectQuery = filters.proyecto
    ? 'id, folio, folio_fisico, total, moneda, estado, creado_en, obra:obras!inner(nombre), proveedor:proveedores(nombre), facturas:orden_compra_facturas(id)'
    : 'id, folio, folio_fisico, total, moneda, estado, creado_en, obra:obras(nombre), proveedor:proveedores(nombre), facturas:orden_compra_facturas(id)'

  let query = supabase
    .from('ordenes_compra')
    .select(selectQuery, { count: 'exact' })
    .order('creado_en', { ascending: false })
    .order('id', { ascending: false })
  if (filters.estatus) query = query.eq('estado', filters.estatus)
  if (filters.desde) query = query.gte('creado_en', filters.desde + 'T00:00:00Z')
  if (filters.hasta)
    query = query.lt(
      'creado_en',
      new Date(Date.parse(filters.hasta) + 86400000).toISOString()
    )
  if (filters.q) query = query.ilike('folio', '%' + filters.q + '%')
  if (filters.proyecto) query = query.ilike('obra.nombre', '%' + filters.proyecto + '%')
  const { data: ordenes, error, count } = await query.range(filters.from, filters.to)

  return (
    <main className="page-shell">
      <PageHeader
        title="Órdenes de compra"
        description="Emitidas desde cotizaciones o requisiciones pagadas"
        actions={
          <Link href="/proveedores" className="btn-secondary btn-sm">
            Proveedores
          </Link>
        }
      />

      <ListFilters
        path="/ordenes"
        params={params}
        statuses={STATUSES}
        searchLabel="Folio de orden"
        estatusAsChips
        compact
      />
      {error && (
        <div className="card border-danger/40 bg-danger-soft text-danger-soft-foreground mb-4">
          No se pudieron cargar las órdenes.
        </div>
      )}

      <div className="list-stack">
        {(ordenes as unknown as OrdenRow[] | null)?.map((o) => {
          const numFacturas = o.facturas?.length ?? 0
          const badgeVariantType =
            o.estado === 'emitida'
              ? 'info'
              : o.estado === 'completada' || o.estado === 'recibida'
                ? 'success'
                : o.estado === 'parcialmente_recibida'
                  ? 'warning'
                  : 'neutral'

          return (
            <Link
              key={o.id}
              href={`/ordenes/${o.id}`}
              className="list-row group items-center"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold tabular-nums text-foreground group-hover:text-primary">{o.folio}</p>
                  {o.folio_fisico && (
                    <span className="text-[11px] font-semibold text-warning-soft-foreground bg-warning-soft px-1.5 py-0.5 rounded border border-warning/30">
                      Talonario: {o.folio_fisico}
                    </span>
                  )}
                  <Badge variant={badgeVariantType} dot>
                    {o.estado.replaceAll('_', ' ')}
                  </Badge>
                  {numFacturas > 0 ? (
                    <Badge variant="success">Factura ({numFacturas})</Badge>
                  ) : (
                    <Badge variant="neutral">Sin factura</Badge>
                  )}
                </div>
                <p className="text-sm font-medium text-foreground mt-0.5 truncate">
                  {o.obra?.nombre}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {o.proveedor?.nombre || (
                    <span className="italic text-muted-foreground">Sin proveedor</span>
                  )}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold tabular-nums text-foreground sm:text-base">
                  {formatMoneyMx(Number(o.total))}{' '}
                  <span className="text-xs font-medium text-muted-foreground">{o.moneda}</span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                  {new Date(o.creado_en).toLocaleDateString('es-MX')}
                </p>
              </div>
            </Link>
          )
        })}
        {ordenes?.length === 0 && (
          <div className="p-4">
            <EmptyState
              icon={IconDocumento}
              title="Sin órdenes de compra"
              description="Todavía no hay órdenes de compra emitidas en el sistema."
            />
          </div>
        )}
      </div>
      {!error && (
        <ListPagination
          path="/ordenes"
          params={params}
          page={filters.page}
          total={count ?? 0}
        />
      )}
    </main>
  )
}
