import Link from 'next/link'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeSolicitarTraspaso } from '@/lib/roles'
import { esRelacionAusente } from '@/lib/schema-disponible'
import { createClient } from '@/lib/supabase/server'
import type { EstadoTraspaso } from '@/lib/types'

interface TraspasoRow {
  id: string
  folio: string
  estado: EstadoTraspaso
  motivo: string | null
  creado_en: string
  obra_origen: { nombre: string; fraccionamiento: string | null } | null
  obra_destino: { nombre: string; fraccionamiento: string | null } | null
  solicitante: { nombre: string } | null
  items: {
    id: string
    cantidad: number
    material: { nombre_base: string; variante: string | null; unidad_medida: string } | null
  }[]
}

function badgeEstado(estado: EstadoTraspaso) {
  switch (estado) {
    case 'completado':
      return 'badge-teal'
    case 'en_transito':
      return 'badge-navy'
    case 'solicitado':
      return 'badge-amber'
    case 'rechazado':
    case 'cancelado':
    default:
      return 'badge-gray'
  }
}

function labelEstado(estado: EstadoTraspaso) {
  switch (estado) {
    case 'solicitado':
      return 'solicitado'
    case 'en_transito':
      return 'en tránsito'
    case 'completado':
      return 'completado'
    case 'rechazado':
      return 'rechazado'
    case 'cancelado':
      return 'cancelado'
    default:
      return estado
  }
}

export default async function TraspasosPage() {
  const session = await getSessionUsuario()
  const puedeCrear = puedeSolicitarTraspaso(session?.rol ?? null)
  const supabase = createClient()

  const { data: traspasos, error } = await supabase
    .from('traspasos_obra')
    .select(
      `
      id,
      folio,
      estado,
      motivo,
      creado_en,
      obra_origen:obras!obra_origen_id(nombre, fraccionamiento),
      obra_destino:obras!obra_destino_id(nombre, fraccionamiento),
      solicitante:usuarios!solicitante_id(nombre),
      items:traspaso_items(
        id,
        cantidad,
        material:catalogo_materiales(nombre_base, variante, unidad_medida)
      )
    `
    )
    .order('creado_en', { ascending: false })

  const lista = (traspasos as unknown as TraspasoRow[] | null) ?? []
  const schemaAusente = error ? esRelacionAusente(error) : false

  return (
    <main className="page-shell">
      <header className="mb-6 flex items-start justify-between gap-3 pt-2">
        <div>
          <h1 className="text-2xl font-bold text-ink">Traspasos entre proyectos</h1>
          <p className="text-sm text-gray-500">
            Mueve material de un proyecto a otro. El dinero sigue al material.
          </p>
        </div>
        {puedeCrear && !schemaAusente && (
          <Link
            href="/traspasos/nuevo"
            className="btn-primary shrink-0 px-4 py-2 text-sm"
          >
            Nuevo traspaso
          </Link>
        )}
      </header>

      {schemaAusente && (
        <div className="card border-amber-200 bg-amber-50 text-amber-900">
          Los traspasos todavía no están activos en la base. Cuando se aplique la
          migración, este listado va a funcionar.
        </div>
      )}

      {error && !schemaAusente && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          No se pudieron cargar los traspasos. Revisa tu conexión.
        </div>
      )}

      {!schemaAusente && lista.length === 0 && !error && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="font-medium text-gray-500">No hay traspasos registrados</p>
          <p className="mt-1 text-xs text-gray-400">
            Los traspasos entre proyectos aparecerán en este panel
          </p>
        </div>
      )}

      {!schemaAusente && lista.length > 0 && (
        <div className="space-y-3">
          {lista.map((t) => {
            const fecha = new Date(t.creado_en).toLocaleDateString('es-MX', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })
            const numItems = t.items?.length || 0

            return (
              <Link
                key={t.id}
                href={`/traspasos/${t.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#132A45] text-sm">{t.folio}</span>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeEstado(
                          t.estado
                        )}`}
                      >
                        {labelEstado(t.estado)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{fecha}</p>
                  </div>
                  <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                    {numItems} {numItems === 1 ? 'material' : 'materiales'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-2.5 rounded-lg my-2 border border-gray-100">
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase font-semibold">
                      Origen
                    </span>
                    <span className="font-medium text-gray-800">
                      {t.obra_origen?.nombre ?? 'Sin especificar'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase font-semibold">
                      Destino
                    </span>
                    <span className="font-medium text-gray-800">
                      {t.obra_destino?.nombre ?? 'Sin especificar'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                  <span>Solicita: {t.solicitante?.nombre ?? 'Anónimo'}</span>
                  <span className="text-[#132A45] font-semibold hover:underline">
                    Ver detalle →
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
