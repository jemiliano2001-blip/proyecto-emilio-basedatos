import Link from 'next/link'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeSolicitarTraspaso } from '@/lib/roles'
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
      return 'bg-green-100 text-green-700'
    case 'en_transito':
      return 'bg-blue-100 text-blue-700'
    case 'solicitado':
      return 'bg-amber-100 text-amber-700'
    case 'rechazado':
    case 'cancelado':
    default:
      return 'bg-gray-100 text-gray-500'
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

  return (
    <main className="max-w-2xl mx-auto p-4 pb-28">
      <header className="mb-6 pt-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#132A45]">Traspasos entre obras</h1>
          <p className="text-gray-500 text-sm">
            Movimiento y transferencia de excedentes de materiales
          </p>
        </div>
        {puedeCrear && (
          <Link
            href="/traspasos/nuevo"
            className="bg-[#132A45] hover:bg-[#1f3f66] text-white font-semibold shrink-0 text-sm py-2 px-4 rounded-lg shadow-sm transition"
          >
            + Nuevo Traspaso
          </Link>
        )}
      </header>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">
          Error al cargar traspasos: {error.message}
        </div>
      )}

      {lista.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
          <p className="text-gray-500 font-medium">No hay traspasos registrados</p>
          <p className="text-gray-400 text-xs mt-1">
            Los traspasos entre proyectos aparecerán en este panel
          </p>
        </div>
      ) : (
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
