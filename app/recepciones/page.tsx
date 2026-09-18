import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { IconCheckCircle, IconChevron, IconPaquete } from '@/components/icons'
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

  const historial = puedeRevisar ? otras : rows
  const variantEstado = (estado: EstadoRecepcion): 'success' | 'warning' | 'danger' =>
    estado === 'aprobada' ? 'success' : estado === 'pendiente_revision' ? 'warning' : 'danger'

  return (
    <main className="page-shell-wide">
      <PageHeader
        title="Recepción"
        description="Checklist de lo recibido contra lo pedido en cada orden de compra."
      />

      <OfflineQueueBanner />

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="space-y-6">
          {puedeCapturar && (
            <section className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <h2 className="text-base font-semibold text-foreground">Órdenes por recibir</h2>
                <span className="text-sm tabular-nums text-muted-foreground">{ordenesChecklist.length}</span>
              </div>
              {ordenesChecklist.length === 0 ? (
                <EmptyState
                  icon={IconPaquete}
                  title="No hay órdenes pendientes de recepción"
                  className="py-8"
                />
              ) : (
                <div className="list-stack">
                  {ordenesChecklist.map((orden) => (
                    <Link key={orden.id} href={`/ordenes/${orden.id}/recibir`} className="list-row group items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold tabular-nums text-foreground group-hover:text-primary">
                            {orden.folio}
                          </p>
                          <Badge variant={orden.estado === 'parcialmente_recibida' ? 'warning' : 'info'}>
                            {orden.estado.replaceAll('_', ' ')}
                          </Badge>
                        </div>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">{orden.obra_nombre}</p>
                        <p className="truncate text-xs text-muted-foreground">{orden.proveedor_nombre}</p>
                      </div>
                      <IconChevron className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}

          {puedeRevisar && (
            <section className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <h2 className="text-base font-semibold text-foreground">Pendientes de revisión</h2>
                <span
                  className={
                    pendientes.length > 0
                      ? 'rounded-full bg-warning-soft px-2.5 py-0.5 text-sm font-semibold tabular-nums text-warning-soft-foreground'
                      : 'text-sm tabular-nums text-muted-foreground'
                  }
                >
                  {pendientes.length}
                </span>
              </div>
              {pendientes.length === 0 ? (
                <EmptyState icon={IconCheckCircle} title="Nada por revisar" className="py-8" />
              ) : (
                <div className="list-stack">
                  {pendientes.map((r) => (
                    <Link
                      key={r.id}
                      href={`/recepciones/${r.id}/revisar`}
                      className="list-row group items-center border-l-2 border-l-warning"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold tabular-nums text-foreground group-hover:text-primary">
                            {r.orden_folio}
                          </p>
                          <Badge variant="warning">Por revisar</Badge>
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {r.receptor_nombre} · {new Date(r.recibido_en).toLocaleString('es-MX')}
                        </p>
                      </div>
                      <span className="btn-secondary btn-xs shrink-0">Revisar</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">Historial</h2>
            <span className="text-sm tabular-nums text-muted-foreground">{historial.length}</span>
          </div>
          {historial.length === 0 ? (
            <EmptyState
              icon={IconPaquete}
              title="Sin recepciones registradas"
              description="Aún no hay recepciones de material en el historial."
            />
          ) : (
            <div className="list-stack">
              {historial.map((r) => (
                <Link key={r.id} href={`/recepciones/${r.id}`} className="list-row group items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold tabular-nums text-foreground group-hover:text-primary">
                      {r.orden_folio}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                      {new Date(r.recibido_en).toLocaleString('es-MX')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={variantEstado(r.estado)} dot>
                      {etiquetaEstado(r.estado)}
                    </Badge>
                    <IconChevron className="size-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
