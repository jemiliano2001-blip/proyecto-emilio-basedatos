import Link from 'next/link'
import { Badge } from '@/components/Badge'
import type { EstadoSolicitud } from '@/lib/types'

export interface SolicitudNavRow {
  id: string
  estado: EstadoSolicitud
  creado_en: string
  obraNombre: string
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
    default:
      return 'amber'
  }
}

function labelEstado(estado: EstadoSolicitud): string {
  switch (estado) {
    case 'en_proceso':
      return 'en proceso'
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

/** Columna izquierda del workbench desktop en detalle de solicitud */
export function SolicitudesWorkbenchNav({
  items,
  activeId,
}: {
  items: SolicitudNavRow[]
  activeId: string
}) {
  return (
    <aside className="hidden lg:flex lg:flex-col min-h-0 w-full max-w-[340px] shrink-0">
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] max-h-[calc(100dvh-5rem)] flex flex-col rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-3 py-2.5 border-b border-border bg-muted/40 flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-foreground">Cola</p>
          <Link
            href="/solicitudes"
            className="text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            Ver todas
          </Link>
        </div>
        <nav
          className="overflow-y-auto divide-y divide-border/50"
          aria-label="Requisiciones recientes"
        >
          {items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Sin otras requisiciones.</p>
          ) : (
            items.map((s) => {
              const active = s.id === activeId
              const reqCode = `REQ-${s.id.slice(0, 8).toUpperCase()}`
              return (
                <Link
                  key={s.id}
                  href={`/solicitudes/${s.id}`}
                  aria-current={active ? 'page' : undefined}
                  className={
                    active
                      ? 'block px-3 py-3 bg-muted/80 border-l-2 border-l-primary'
                      : 'block px-3 py-3 hover:bg-muted/50 border-l-2 border-l-transparent'
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] font-bold text-foreground truncate">
                        {reqCode}
                      </p>
                      <p className="text-sm font-semibold text-foreground truncate mt-0.5">
                        {s.obraNombre}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                        {new Date(s.creado_en).toLocaleDateString('es-MX', {
                          dateStyle: 'short',
                        })}
                      </p>
                    </div>
                    <Badge variant={badgeVariant(s.estado)}>
                      {labelEstado(s.estado)}
                    </Badge>
                  </div>
                </Link>
              )
            })
          )}
        </nav>
      </div>
    </aside>
  )
}
