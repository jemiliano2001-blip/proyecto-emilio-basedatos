import Link from 'next/link'
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
}

function badgeEstado(estado: EstadoSolicitud) {
  switch (estado) {
    case 'cancelada':
    case 'rechazada':
      return 'badge-red'
    case 'finalizada':
    case 'aprobada':
      return 'badge-teal'
    case 'en_proceso':
    case 'en_cotizacion':
      return 'badge-navy'
    case 'recibida':
    case 'pendiente':
    default:
      return 'badge-amber'
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
  return s.items.some((i) => i.obra_id !== null)
}

export default async function SolicitudesPage() {
  const session = await getSessionUsuario()
  const puedeCrear = puedeCrearSolicitudes(session?.rol ?? null)
  const verTodas = puedeVerTodasLasSolicitudes(session?.rol ?? null)
  const esCompras = puedeAprobarCompras(session?.rol ?? null)
  const esFinanzas = puedeAprobarPago(session?.rol ?? null)
  const supabase = createClient()

  const { data: solicitudes, error } = await supabase
    .from('solicitudes_material')
    .select(
      'id, estado, creado_en, obra:obras(nombre, fraccionamiento), solicitante:usuarios(nombre), items:solicitud_items(id, obra_id)'
    )
    .order('creado_en', { ascending: false })

  const lista = (solicitudes as unknown as SolicitudRow[] | null) ?? []
  const bandejaCompras = lista.filter(
    (s) => s.estado === 'recibida' || s.estado === 'pendiente'
  )
  const bandejaFinanzas = lista.filter((s) => s.estado === 'en_proceso')

  return (
    <main className="page-shell">
      <header className="mb-6 flex items-start justify-between gap-3 pt-2">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            {verTodas ? 'Control de solicitudes' : 'Mis solicitudes'}
          </h1>
          <p className="text-gray-500 text-sm">
            {verTodas
              ? 'Requisiciones por estatus · Compras → Finanzas'
              : 'Lo que has solicitado para tus proyectos'}
          </p>
        </div>
        {puedeCrear && (
          <Link href="/solicitudes/nueva" className="btn-primary shrink-0 text-sm py-2 px-4">
            Nueva
          </Link>
        )}
      </header>

      <OfflineQueueBanner />

      {error && (
        <div className="card mb-4 border-red-300 bg-red-50 text-red-700">
          No se pudieron cargar las solicitudes. Revisa tu conexión.
        </div>
      )}

      {esCompras && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Bandeja Compras (recibidas)
          </h2>
          <div className="space-y-2">
            {bandejaCompras.map((s) => (
              <Link key={s.id} href={`/solicitudes/${s.id}`} className="card-interactive block">
                <div className="flex justify-between items-center gap-2">
                  <p className="font-semibold text-ink truncate">{s.obra?.nombre ?? 'Proyecto'}</p>
                  <span className={badgeEstado(s.estado)}>
                    {labelEstado(s.estado)}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {s.items.length} renglón{s.items.length === 1 ? '' : 'es'}{esMultiObra(s) ? ' · varios proyectos' : ''}
                  {s.solicitante?.nombre ? ` · ${s.solicitante.nombre}` : ''}
                </p>
              </Link>
            ))}
            {bandejaCompras.length === 0 && (
              <p className="text-sm text-gray-400 py-2">No hay requisiciones pendientes de Compras.</p>
            )}
          </div>
        </section>
      )}

      {esFinanzas && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Bandeja Finanzas (en proceso)
          </h2>
          <div className="space-y-2">
            {bandejaFinanzas.map((s) => (
              <Link key={s.id} href={`/solicitudes/${s.id}`} className="card-interactive block">
                <div className="flex justify-between items-center gap-2">
                  <p className="font-semibold text-ink truncate">{s.obra?.nombre ?? 'Proyecto'}</p>
                  <span className={badgeEstado(s.estado)}>
                    {labelEstado(s.estado)}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {s.items.length} renglón{s.items.length === 1 ? '' : 'es'}{esMultiObra(s) ? ' · varios proyectos' : ''}
                  {s.solicitante?.nombre ? ` · ${s.solicitante.nombre}` : ''}
                </p>
              </Link>
            ))}
            {bandejaFinanzas.length === 0 && (
              <p className="text-sm text-gray-400 py-2">No hay requisiciones pendientes de pago.</p>
            )}
          </div>
        </section>
      )}

      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Todas
      </h2>
      <div className="space-y-3">
        {lista.map((s) => (
          <Link key={s.id} href={`/solicitudes/${s.id}`} className="card-interactive block">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-ink">{s.obra?.nombre ?? 'Proyecto'}</p>
                {s.obra?.fraccionamiento && (
                  <p className="text-xs text-gray-500">{s.obra.fraccionamiento}</p>
                )}
              </div>
              <span className={badgeEstado(s.estado)}>
                {labelEstado(s.estado)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm text-gray-500">
              <span>
                {s.items.length} renglón{s.items.length === 1 ? '' : 'es'}{esMultiObra(s) ? ' · varios proyectos' : ''}
                {verTodas && s.solicitante?.nombre ? ` · ${s.solicitante.nombre}` : ''}
              </span>
              <span>{new Date(s.creado_en).toLocaleDateString('es-MX')}</span>
            </div>
          </Link>
        ))}

        {lista.length === 0 && (
          <p className="text-gray-500 text-center py-8">
            {verTodas
              ? 'Todavía no hay requisiciones.'
              : 'Todavía no has levantado ninguna requisición.'}
          </p>
        )}
      </div>
    </main>
  )
}
