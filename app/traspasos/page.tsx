import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { IconPlus, IconPaquete } from '@/components/icons'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeSolicitarTraspaso, puedeVerTraspasos } from '@/lib/roles'
import { redirect } from 'next/navigation'
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

function badgeVariant(estado: EstadoTraspaso): 'teal' | 'navy' | 'amber' | 'gray' {
  switch (estado) {
    case 'completado':
      return 'teal'
    case 'en_transito':
      return 'navy'
    case 'solicitado':
      return 'amber'
    case 'rechazado':
    case 'cancelado':
    default:
      return 'gray'
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
  if (!session || !puedeVerTraspasos(session.rol)) {
    redirect('/solicitudes')
  }
  const puedeCrear = puedeSolicitarTraspaso(session?.rol ?? null)
  const supabase = await createClient()

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
      <PageHeader
        title="Traspasos entre proyectos"
        description="Mueve material de un proyecto a otro. El dinero sigue al material."
        action={
          puedeCrear && !schemaAusente
            ? {
                label: 'Nuevo traspaso',
                href: '/traspasos/nuevo',
                icon: IconPlus,
              }
            : undefined
        }
      />

      {schemaAusente && (
        <div className="card border-amber-200 bg-amber-50 text-amber-900 mb-4">
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
        <EmptyState
          icon={IconPaquete}
          title="No hay traspasos registrados"
          description="Los traspasos entre proyectos aparecerán en este panel."
          action={
            puedeCrear
              ? {
                  label: 'Nuevo traspaso',
                  href: '/traspasos/nuevo',
                  icon: IconPlus,
                }
              : undefined
          }
        />
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
                className="card-interactive block"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ink text-sm">{t.folio}</span>
                      <Badge variant={badgeVariant(t.estado)}>
                        {labelEstado(t.estado)}
                      </Badge>
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
                  <span className="text-accent font-semibold hover:underline">
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
