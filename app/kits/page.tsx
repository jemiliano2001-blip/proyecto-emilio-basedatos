import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { IconPlus, IconPaquete } from '@/components/icons'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarKits, puedeVerPrecios } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { formatMoneyMx } from '@/lib/money'

export default async function KitsPage() {
  const session = await getSessionUsuario()
  const puedeGestionar = puedeGestionarKits(session?.rol ?? null)
  const verPrecios = puedeVerPrecios(session?.rol ?? null)
  const supabase = await createClient()

  const { data: kitsRaw, error } = await supabase
    .from('material_kits')
    .select(`
      id,
      nombre,
      material_principal_id,
      configuracion,
      descripcion,
      activo,
      creado_en,
      material_principal:catalogo_materiales!material_kits_material_principal_id_fkey(
        nombre_base,
        variante
      ),
      material_kit_items (
        id,
        kit_id,
        material_id,
        cantidad,
        catalogo_materiales (
          id,
          nombre_base,
          variante,
          unidad_medida,
          precio_base
        )
      )
    `)
    .order('creado_en', { ascending: false })

  interface KitItemDbRow {
    id: string
    kit_id: string
    material_id: string
    cantidad: number
    catalogo_materiales?: {
      id: string
      nombre_base: string
      variante: string | null
      unidad_medida: string
      precio_base: number | null
    } | null
  }

  interface KitDbRow {
    id: string
    nombre: string
    material_principal_id: string | null
    configuracion: string | null
    descripcion: string | null
    activo: boolean
    creado_en: string
    material_principal?: {
      nombre_base: string
      variante: string | null
    } | null
    material_kit_items?: KitItemDbRow[]
  }

  const kits = (kitsRaw as unknown as KitDbRow[]) ?? []

  return (
    <main className="page-shell space-y-6">
      <PageHeader
        title="Kits y Ensambles"
        description="Plantillas para agrupar equipos principales con sus accesorios y componentes menores."
        action={
          puedeGestionar
            ? {
                label: 'Nuevo kit',
                href: '/kits/nuevo',
                icon: IconPlus,
              }
            : undefined
        }
      />

      <div className="space-y-4">
        {error && (
          <div role="alert" className="card border-danger/30 bg-danger-soft text-danger-soft-foreground">
            No se pudieron cargar los kits. Revisa tu conexión e intenta de nuevo.
          </div>
        )}
        {kits.map((kit) => (
          <div key={kit.id} className="card space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-2">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-foreground">{kit.nombre}</h2>
                  {kit.configuracion && (
                    <Badge variant="teal">
                      {kit.configuracion}
                    </Badge>
                  )}
                  {!kit.activo && <Badge variant="gray">Inactivo</Badge>}
                </div>
                {kit.material_principal && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Equipo principal: <span className="font-semibold text-foreground">{kit.material_principal.nombre_base} {kit.material_principal.variante ? `· ${kit.material_principal.variante}` : ''}</span>
                  </p>
                )}
                {kit.descripcion && (
                  <p className="text-xs text-muted-foreground mt-0.5">{kit.descripcion}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground font-medium">
                  {kit.material_kit_items?.length ?? 0} componentes
                </span>
                {puedeGestionar && (
                  <Link
                    href={`/kits/${kit.id}/editar`}
                    className="btn-secondary text-sm px-2.5 py-2 min-h-[44px] inline-flex items-center"
                  >
                    Editar
                  </Link>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Componentes menores (&quot;chiquitiaje&quot;):
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {kit.material_kit_items?.map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center justify-between p-2 rounded bg-muted/50 text-xs border border-border"
                  >
                    <span className="font-medium text-foreground truncate pr-2">
                      {it.catalogo_materiales?.nombre_base}{' '}
                      {it.catalogo_materiales?.variante
                        ? `· ${it.catalogo_materiales.variante}`
                        : ''}
                    </span>
                    <div className="shrink-0 text-right">
                      <span className="font-bold text-primary-soft-foreground tabular-nums">
                        {it.cantidad} {it.catalogo_materiales?.unidad_medida}
                      </span>
                      {verPrecios &&
                        it.catalogo_materiales?.precio_base !== undefined &&
                        it.catalogo_materiales.precio_base !== null &&
                        it.catalogo_materiales.precio_base > 0 && (
                          <span className="text-[11px] text-muted-foreground ml-1">
                            ({formatMoneyMx(it.catalogo_materiales.precio_base)})
                          </span>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {kits.length === 0 && !error && (
          <EmptyState
            icon={IconPaquete}
            title="No hay kits registrados aún"
            description="Crea el primer ensamble de transformador u otro equipo con sus accesorios para cargar a obras con un solo clic."
            action={
              puedeGestionar
                ? {
                    label: 'Nuevo kit',
                    href: '/kits/nuevo',
                    icon: IconPlus,
                  }
                : undefined
            }
          />
        )}
      </div>
    </main>
  )
}
