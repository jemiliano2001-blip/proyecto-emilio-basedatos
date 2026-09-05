import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { IconDocumento } from '@/components/icons'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeVerPrecios } from '@/lib/roles'
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

export default async function OrdenesPage() {
  const session = await getSessionUsuario()
  if (!session || !puedeVerPrecios(session.rol)) {
    redirect('/')
  }

  const supabase = createClient()
  const { data: ordenes, error } = await supabase
    .from('ordenes_compra')
    .select(
      'id, folio, folio_fisico, total, moneda, estado, creado_en, obra:obras(nombre), proveedor:proveedores(nombre), facturas:orden_compra_facturas(id)'
    )
    .order('creado_en', { ascending: false })

  return (
    <main className="page-shell">
      <PageHeader
        title="Órdenes de compra"
        description="Emitidas desde cotizaciones o requisiciones pagadas"
        action={{
          label: 'Proveedores',
          href: '/proveedores',
        }}
      />

      {error && (
        <div className="card border-red-300 bg-red-50 text-red-700 mb-4">
          No se pudieron cargar las órdenes.
        </div>
      )}

      <div className="space-y-3">
        {(ordenes as unknown as OrdenRow[] | null)?.map((o) => {
          const numFacturas = o.facturas?.length ?? 0
          const badgeVariantType =
            o.estado === 'emitida'
              ? 'navy'
              : o.estado === 'completada' || o.estado === 'recibida'
              ? 'teal'
              : o.estado === 'parcialmente_recibida'
              ? 'amber'
              : 'gray'

          return (
            <Link key={o.id} href={`/ordenes/${o.id}`} className="card-interactive block">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-ink">{o.folio}</p>
                    {o.folio_fisico && (
                      <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        Talonario: {o.folio_fisico}
                      </span>
                    )}
                    <Badge variant={badgeVariantType}>
                      {o.estado.replaceAll('_', ' ')}
                    </Badge>
                    {numFacturas > 0 ? (
                      <Badge variant="teal">
                        Factura ({numFacturas})
                      </Badge>
                    ) : (
                      <Badge variant="gray">
                        Sin factura
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-700 mt-1">{o.obra?.nombre}</p>
                  <p className="text-xs text-gray-400">
                    {o.proveedor?.nombre || <span className="italic">Sin proveedor</span>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold tabular-nums text-ink">
                    ${Number(o.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}{' '}
                    <span className="text-xs font-medium text-gray-500">{o.moneda}</span>
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {new Date(o.creado_en).toLocaleDateString('es-MX')}
                  </p>
                </div>
              </div>
            </Link>
          )
        })}
        {ordenes?.length === 0 && (
          <EmptyState
            icon={IconDocumento}
            title="Sin órdenes de compra"
            description="Todavía no hay órdenes de compra emitidas en el sistema."
          />
        )}
      </div>
    </main>
  )
}
