import Link from 'next/link'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarKits, puedeVerPrecios } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { formatMoneyMx } from '@/lib/money'
import type { CatalogoMaterial, MaterialKitWithItems } from '@/lib/types'

export default async function KitsPage() {
  const session = await getSessionUsuario()
  const puedeGestionar = puedeGestionarKits(session?.rol ?? null)
  const verPrecios = puedeVerPrecios(session?.rol ?? null)
  const supabase = createClient()

  const { data: kitsRaw } = await supabase
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
      <header className="mb-4 pt-2 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Kits y Ensambles</h1>
          <p className="text-gray-500 text-sm">
            Plantillas para agrupar equipos principales con sus accesorios y componentes menores.
          </p>
        </div>
        {puedeGestionar && (
          <Link href="/kits/nuevo" className="btn-primary shrink-0 text-sm py-2 px-4">
            + Nuevo Kit
          </Link>
        )}
      </header>

      <div className="space-y-4">
        {kits.map((kit) => (
          <div key={kit.id} className="card space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-ink">{kit.nombre}</h2>
                  {kit.configuracion && (
                    <span className="badge-teal text-xs">
                      {kit.configuracion}
                    </span>
                  )}
                </div>
                {kit.material_principal && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Equipo principal: <span className="font-semibold text-gray-700">{kit.material_principal.nombre_base} {kit.material_principal.variante ? `· ${kit.material_principal.variante}` : ''}</span>
                  </p>
                )}
                {kit.descripcion && (
                  <p className="text-xs text-gray-400 mt-0.5">{kit.descripcion}</p>
                )}
              </div>
              <span className="text-xs text-gray-400 font-medium">
                {kit.material_kit_items?.length ?? 0} componentes
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Componentes menores (&quot;chiquitiaje&quot;):
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {kit.material_kit_items?.map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center justify-between p-2 rounded bg-gray-50 text-xs border border-gray-100"
                  >
                    <span className="font-medium text-gray-800 truncate pr-2">
                      {it.catalogo_materiales?.nombre_base}{' '}
                      {it.catalogo_materiales?.variante
                        ? `· ${it.catalogo_materiales.variante}`
                        : ''}
                    </span>
                    <div className="shrink-0 text-right">
                      <span className="font-bold text-teal-800 tabular-nums">
                        {it.cantidad} {it.catalogo_materiales?.unidad_medida}
                      </span>
                      {verPrecios &&
                        it.catalogo_materiales?.precio_base !== undefined &&
                        it.catalogo_materiales.precio_base !== null &&
                        it.catalogo_materiales.precio_base > 0 && (
                          <span className="text-[11px] text-gray-400 ml-1">
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

        {kits.length === 0 && (
          <div className="card text-center py-12 px-4 border-dashed border-gray-300">
            <p className="text-gray-500 font-medium">No hay kits registrados aún.</p>
            <p className="text-xs text-gray-400 mt-1">
              Crea el primer ensamble de transformador u otro equipo con sus accesorios para cargar a obras con un solo clic.
            </p>
            {puedeGestionar && (
              <Link href="/kits/nuevo" className="btn-primary mt-4 inline-flex">
                + Crear primer kit
              </Link>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
