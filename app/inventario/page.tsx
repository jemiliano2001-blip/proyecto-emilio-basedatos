import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'
import { IconPaquete, IconChevron } from '@/components/icons'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeVerInventarioCampo } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'

interface InventarioRow {
  obra_id: string
  material_id: string
  cantidad_recibida: number
  cantidad_instalada: number
  cantidad_pendiente_instalar: number
}

interface ObraResumen {
  id: string
  nombre: string
  fraccionamiento: string | null
  pendientes: number
  materiales: number
}

export default async function InventarioPage() {
  const session = await getSessionUsuario()
  if (!session || !puedeVerInventarioCampo(session.rol)) {
    redirect('/solicitudes')
  }

  const supabase = await createClient()
  const { data: invData, error: invError } = await supabase
    .from('v_inventario_campo_obra')
    .select(
      'obra_id, material_id, cantidad_recibida, cantidad_instalada, cantidad_pendiente_instalar'
    )

  const rows = (invData ?? []) as InventarioRow[]
  const byObra = new Map<string, { pendientes: number; materiales: number }>()
  for (const r of rows) {
    const cur = byObra.get(r.obra_id) ?? { pendientes: 0, materiales: 0 }
    cur.materiales += 1
    cur.pendientes += Number(r.cantidad_pendiente_instalar) > 0 ? 1 : 0
    byObra.set(r.obra_id, cur)
  }

  const obraIds = Array.from(byObra.keys())
  const { data: obrasData } =
    obraIds.length > 0
      ? await supabase
          .from('obras')
          .select('id, nombre, fraccionamiento')
          .in('id', obraIds)
          .order('nombre')
      : { data: [] }

  const lista: ObraResumen[] = ((obrasData ?? []) as {
    id: string
    nombre: string
    fraccionamiento: string | null
  }[]).map((o) => ({
    id: o.id,
    nombre: o.nombre,
    fraccionamiento: o.fraccionamiento,
    pendientes: byObra.get(o.id)?.pendientes ?? 0,
    materiales: byObra.get(o.id)?.materiales ?? 0,
  }))

  return (
    <main className="page-shell">
      <PageHeader
        title="Inventario en obra"
        subtitle="Material recibido en sitio y pendiente de instalar"
      />

      {invError && (
        <div role="alert" className="card mb-4 border-danger/40 bg-danger-soft text-danger-soft-foreground">
          No se pudo cargar el inventario. Revisa la conexión e intenta de nuevo.
        </div>
      )}

      {lista.length === 0 && !invError ? (
        <EmptyState
          icon={IconPaquete}
          title="Sin inventario aún"
          description="Cuando se aprueben recepciones, aquí verás el material en cada proyecto."
        />
      ) : (
        <div className="list-stack">
          <div className="list-header lg:grid-cols-[minmax(0,1fr)_8rem_8rem_1.5rem]">
            <span>Proyecto</span>
            <span className="text-right">Materiales</span>
            <span className="text-right">Por instalar</span>
            <span />
          </div>
          {lista.map((o) => (
            <Link
              key={o.id}
              href={`/inventario/${o.id}`}
              className="list-row group items-center lg:grid lg:grid-cols-[minmax(0,1fr)_8rem_8rem_1.5rem] lg:gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary">{o.nombre}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {[o.fraccionamiento, `${o.materiales} material${o.materiales === 1 ? '' : 'es'}`]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <p className="hidden text-right text-sm tabular-nums text-muted-foreground lg:block">{o.materiales}</p>
              <div className="flex shrink-0 items-center justify-end gap-2">
                <span
                  className={
                    o.pendientes > 0
                      ? 'inline-flex min-w-[2.5rem] items-center justify-center rounded-full bg-primary-soft px-2.5 py-1 text-sm font-semibold tabular-nums text-primary-soft-foreground'
                      : 'inline-flex min-w-[2.5rem] items-center justify-center rounded-full bg-muted px-2.5 py-1 text-sm font-semibold tabular-nums text-muted-foreground'
                  }
                  aria-label={`${o.pendientes} por instalar`}
                >
                  {o.pendientes}
                </span>
                <span className="text-xs text-muted-foreground lg:hidden">por instalar</span>
              </div>
              <IconChevron className="hidden size-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary lg:block" />
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
