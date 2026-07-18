import Link from 'next/link'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeCrearSolicitudes, puedeVerTodasLasSolicitudes } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { EstadoSolicitud } from '@/lib/types'

interface SolicitudRow {
  id: string
  estado: EstadoSolicitud
  creado_en: string
  obra: { nombre: string; fraccionamiento: string | null } | null
  solicitante: { nombre: string } | null
  items: { id: string }[]
}

function badgeEstado(estado: EstadoSolicitud) {
  switch (estado) {
    case 'cancelada':
    case 'rechazada':
      return 'bg-gray-100 text-gray-500'
    case 'aprobada':
      return 'bg-green-100 text-green-700'
    case 'en_cotizacion':
      return 'bg-blue-100 text-blue-700'
    default:
      return 'bg-amber-100 text-amber-700'
  }
}

function labelEstado(estado: EstadoSolicitud) {
  if (estado === 'en_cotizacion') return 'en cotización'
  return estado
}

export default async function SolicitudesPage() {
  const session = await getSessionUsuario()
  const puedeCrear = puedeCrearSolicitudes(session?.rol ?? null)
  const verTodas = puedeVerTodasLasSolicitudes(session?.rol ?? null)
  const supabase = createClient()

  const { data: solicitudes, error } = await supabase
    .from('solicitudes_material')
    .select(
      'id, estado, creado_en, obra:obras(nombre, fraccionamiento), solicitante:usuarios(nombre), items:solicitud_items(id)'
    )
    .order('creado_en', { ascending: false })

  return (
    <main className="max-w-2xl mx-auto p-4 pb-28">
      <header className="mb-6 pt-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#132A45]">
            {verTodas ? 'Solicitudes' : 'Mis solicitudes'}
          </h1>
          <p className="text-gray-500 text-sm">
            {verTodas
              ? 'De todo el personal, por obra'
              : 'Lo que has solicitado para tus obras'}
          </p>
        </div>
        {puedeCrear && (
          <Link href="/solicitudes/nueva" className="btn-primary shrink-0 text-sm py-2 px-4">
            Nueva
          </Link>
        )}
      </header>

      {error && (
        <div className="card border-red-300 bg-red-50 text-red-700 mb-4">
          No se pudieron cargar las solicitudes. Revisa tu conexión.
        </div>
      )}

      <div className="space-y-3">
        {(solicitudes as unknown as SolicitudRow[] | null)?.map((s) => (
          <Link key={s.id} href={`/solicitudes/${s.id}`} className="card block">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{s.obra?.nombre ?? 'Obra'}</p>
                {s.obra?.fraccionamiento && (
                  <p className="text-xs text-gray-500">{s.obra.fraccionamiento}</p>
                )}
              </div>
              <span
                className={`text-xs font-semibold rounded-full px-2 py-1 capitalize shrink-0 ${badgeEstado(
                  s.estado
                )}`}
              >
                {labelEstado(s.estado)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm text-gray-500">
              <span>
                {s.items.length} material{s.items.length === 1 ? '' : 'es'}
                {verTodas && s.solicitante?.nombre ? ` · ${s.solicitante.nombre}` : ''}
              </span>
              <span>{new Date(s.creado_en).toLocaleDateString('es-MX')}</span>
            </div>
          </Link>
        ))}

        {solicitudes?.length === 0 && (
          <p className="text-gray-500 text-center py-8">
            {verTodas
              ? 'Todavía no hay solicitudes de material.'
              : 'Todavía no has levantado ninguna solicitud.'}
          </p>
        )}
      </div>
    </main>
  )
}
