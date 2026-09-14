import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { IconPaquete } from '@/components/icons'
import { OfflineQueueBanner } from '@/components/OfflineQueueBanner'
import { getSessionUsuario } from '@/lib/auth/session'
import {
  puedeCapturarRecepcion,
  puedeRevisarRecepcion,
  puedeVerRecepciones,
} from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { EstadoOrdenCompra, EstadoRecepcion } from '@/lib/types'

interface RecepcionListaRow {
  id: string
  estado: EstadoRecepcion
  recibido_en: string
  creado_en: string
  orden_id: string
  orden_folio: string
  orden_estado: EstadoOrdenCompra
  receptor_nombre: string
}

interface OrdenChecklistRow {
  id: string
  folio: string
  obra_nombre: string
  proveedor_nombre: string
  estado: EstadoOrdenCompra
  creado_en: string
}

function etiquetaEstado(estado: EstadoRecepcion): string {
  if (estado === 'pendiente_revision') return 'Pendiente de revisión'
  if (estado === 'aprobada') return 'Aprobada'
  return 'Rechazada'
}

export default async function RecepcionesPage() {
  const session = await getSessionUsuario()
  if (!session || !puedeVerRecepciones(session.rol)) {
    redirect('/')
  }

  const supabase = await createClient()
  const puedeCapturar = puedeCapturarRecepcion(session.rol)
  const puedeRevisar = puedeRevisarRecepcion(session.rol)

  const { data: recepciones } = await supabase.rpc('listar_recepciones')
  const rows = (recepciones ?? []) as RecepcionListaRow[]

  let ordenesChecklist: OrdenChecklistRow[] = []
  if (puedeCapturar) {
    const { data } = await supabase.rpc('listar_ordenes_checklist')
    ordenesChecklist = ((data ?? []) as OrdenChecklistRow[]).filter(
      (o) => o.estado === 'emitida' || o.estado === 'parcialmente_recibida'
    )
  }

  const pendientes = rows.filter((r) => r.estado === 'pendiente_revision')
  const otras = rows.filter((r) => r.estado !== 'pendiente_revision')

  return (
    <main className="page-shell">
      <PageHeader
        title="Recepción"
        description="Checklist de materiales recibidos vs lo pedido en la OC."
      />

      <OfflineQueueBanner />

      {puedeCapturar && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Órdenes por recibir
          </h2>
          {ordenesChecklist.length === 0 ? (
            <div className="card text-sm text-gray-500 py-4 text-center">
              No hay órdenes pendientes de recepción.
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
              {ordenesChecklist.map((orden) => (
                <Link
                  key={orden.id}
                  href={`/ordenes/${orden.id}/recibir`}
                  className="block px-3.5 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex justify-between gap-2 items-baseline">
                    <p className="font-semibold text-ink">{orden.folio}</p>
                    <Badge variant="amber">
                      {orden.estado.replaceAll('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5 truncate">{orden.obra_nombre}</p>
                  <p className="text-xs text-gray-500 truncate">{orden.proveedor_nombre}</p>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {puedeRevisar && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Pendientes de revisión ({pendientes.length})
          </h2>
          {pendientes.length === 0 ? (
            <div className="card text-sm text-gray-500 py-4 text-center">Nada por revisar.</div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
              {pendientes.map((r) => (
                <Link
                  key={r.id}
                  href={`/recepciones/${r.id}/revisar`}
                  className="block px-3.5 py-3 hover:bg-slate-50 transition-colors border-l-4 border-l-amber-500"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-ink">{r.orden_folio}</p>
                    <Badge variant="amber">Por revisar</Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {r.receptor_nombre} ·{' '}
                    {new Date(r.recibido_en).toLocaleString('es-MX')}
                  </p>
                  <p className="text-xs text-accent font-medium mt-0.5">Revisar checklist</p>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Historial
        </h2>
        {(puedeRevisar ? otras : rows).length === 0 ? (
          <EmptyState
            icon={IconPaquete}
            title="Sin recepciones registradas"
            description="Aún no hay recepciones de material en el historial."
          />
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
            {(puedeRevisar ? otras : rows).map((r) => (
              <Link
                key={r.id}
                href={`/recepciones/${r.id}`}
                className="block px-3.5 py-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex justify-between items-center gap-2">
                  <p className="font-semibold text-ink">{r.orden_folio}</p>
                  <Badge
                    variant={
                      r.estado === 'aprobada'
                        ? 'teal'
                        : r.estado === 'pendiente_revision'
                        ? 'amber'
                        : 'red'
                    }
                  >
                    {etiquetaEstado(r.estado)}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 tabular-nums">
                  {new Date(r.recibido_en).toLocaleString('es-MX')}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
