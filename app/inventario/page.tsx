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
        <div className="space-y-2">
          {lista.map((o) => (
            <Link
              key={o.id}
              href={`/inventario/${o.id}`}
              className="card-interactive flex items-center justify-between gap-3 min-h-[72px]"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">{o.nombre}</p>
                {o.fraccionamiento && (
                  <p className="text-xs text-muted-foreground">{o.fraccionamiento}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {o.materiales} material{o.materiales === 1 ? '' : 'es'}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                  Pendiente
                </p>
                <p className="text-2xl font-black tabular-nums text-primary leading-none">
                  {o.pendientes}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {o.pendientes === 1 ? 'material' : 'materiales'}
                </p>
              </div>
              <IconChevron className="h-5 w-5 text-muted-foreground shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
