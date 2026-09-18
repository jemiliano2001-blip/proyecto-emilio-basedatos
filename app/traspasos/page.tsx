import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { IconChevron, IconPlus, IconPaquete, IconTraspasos } from '@/components/icons'
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

function badgeVariant(estado: EstadoTraspaso): 'success' | 'info' | 'warning' | 'danger' | 'neutral' {
  switch (estado) {
    case 'completado':
      return 'success'
    case 'en_transito':
      return 'info'
    case 'solicitado':
      return 'warning'
    case 'rechazado':
      return 'danger'
    case 'cancelado':
    default:
      return 'neutral'
  }
}

function labelEstado(estado: EstadoTraspaso) {
  switch (estado) {
    case 'solicitado':
      return 'Solicitado'
    case 'en_transito':
      return 'En tránsito'
    case 'completado':
      return 'Completado'
    case 'rechazado':
      return 'Rechazado'
    case 'cancelado':
      return 'Cancelado'
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
        <div className="card border-warning/30 bg-warning-soft text-warning-soft-foreground mb-4">
          Los traspasos todavía no están activos en la base. Cuando se aplique la
          migración, este listado va a funcionar.
        </div>
      )}

      {error && !schemaAusente && (
        <div className="mb-4 rounded-lg bg-danger-soft p-3 text-sm text-danger-soft-foreground">
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
        <div className="list-stack">
          <div className="list-header lg:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)_6rem_8rem_1.5rem]">
            <span>Folio</span>
            <span>Origen</span>
            <span>Destino</span>
            <span className="text-right">Partidas</span>
            <span>Estatus</span>
            <span />
          </div>
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
                className="list-row group flex-col items-stretch gap-2 lg:grid lg:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)_6rem_8rem_1.5rem] lg:items-center lg:gap-3"
              >
                <div className="flex items-center justify-between gap-2 lg:block">
                  <div>
                    <p className="text-sm font-semibold tabular-nums text-foreground group-hover:text-primary">
                      {t.folio}
                    </p>
                    <p className="text-xs text-muted-foreground">{fecha}</p>
                  </div>
                  <span className="lg:hidden">
                    <Badge variant={badgeVariant(t.estado)}>{labelEstado(t.estado)}</Badge>
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm lg:contents">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground lg:hidden">
                      Origen
                    </p>
                    <p className="truncate text-foreground">{t.obra_origen?.nombre ?? 'Sin especificar'}</p>
                  </div>
                  <IconTraspasos className="size-4 shrink-0 text-muted-foreground lg:hidden" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground lg:hidden">
                      Destino
                    </p>
                    <p className="truncate text-foreground">{t.obra_destino?.nombre ?? 'Sin especificar'}</p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground tabular-nums lg:text-right lg:text-sm">
                  {numItems} {numItems === 1 ? 'material' : 'materiales'}
                  <span className="lg:hidden"> · solicita {t.solicitante?.nombre ?? 'Anónimo'}</span>
                </p>
                <div className="hidden lg:block">
                  <Badge variant={badgeVariant(t.estado)} dot>
                    {labelEstado(t.estado)}
                  </Badge>
                </div>
                <IconChevron className="hidden size-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary lg:block" />
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
