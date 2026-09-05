import Link from 'next/link'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'
import { IconPlus, IconPaquete } from '@/components/icons'
import { getSessionUsuario } from '@/lib/auth/session'
import { CATEGORIAS_MATERIAL } from '@/lib/catalogo-categorias'
import { puedeGestionarCatalogo, puedeVerPrecios } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { CatalogoMaterial } from '@/lib/types'
import { formatMoneyMx } from '@/lib/money'

function MaterialCard({
  m,
  puedeEditar,
  verPrecios,
}: {
  m: CatalogoMaterial
  puedeEditar: boolean
  verPrecios: boolean
}) {
  const body = (
    <>
      <div className="aspect-square bg-gray-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
        {m.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={m.foto_url}
            alt={m.nombre_base}
            className="object-cover w-full h-full"
          />
        ) : (
          <span className="text-gray-300 text-xs">Sin foto</span>
        )}
      </div>
      <p className="font-bold text-sm text-ink line-clamp-2">{m.nombre_base}</p>
      {m.variante && <p className="text-xs text-gray-500 truncate">{m.variante}</p>}
      {m.subcategoria && (
        <p className="text-xs text-gray-400 mt-0.5">{m.subcategoria}</p>
      )}
      <div className="mt-2 flex items-center justify-between pt-1 border-t border-gray-100">
        <span className="text-xs text-gray-400 font-medium">{m.unidad_medida}</span>
        {verPrecios && m.precio_base !== undefined && m.precio_base > 0 && (
          <span className="text-xs font-semibold tabular-nums text-accent">
            {formatMoneyMx(m.precio_base)}
          </span>
        )}
      </div>
    </>
  )

  return puedeEditar ? (
    <Link href={`/materiales/${m.id}`} className="card-interactive block">
      {body}
    </Link>
  ) : (
    <div className="card">{body}</div>
  )
}

export default async function MaterialesPage() {
  const session = await getSessionUsuario()
  const puedeEditar = puedeGestionarCatalogo(session?.rol ?? null)
  const verPrecios = puedeVerPrecios(session?.rol ?? null)
  const supabase = createClient()

  const { data: materiales, error } = await supabase
    .from('catalogo_materiales')
    .select(
      'id, nombre_base, variante, unidad_medida, categoria, subcategoria, especificacion, foto_url, precio_base, activo'
    )
    .eq('activo', true)
    .order('nombre_base')

  const lista = (materiales as CatalogoMaterial[] | null) ?? []

  const porCategoria = CATEGORIAS_MATERIAL.map((cat) => ({
    categoria: cat,
    items: lista.filter((m) => m.categoria === cat),
  })).filter((g) => g.items.length > 0)

  const sinCategoria = lista.filter(
    (m) => !m.categoria || !(CATEGORIAS_MATERIAL as readonly string[]).includes(m.categoria)
  )

  return (
    <main className="page-shell">
      <PageHeader
        title="Catálogo de materiales"
        description="Agrupados por Obra Civil y Electromecánico"
        action={
          puedeEditar
            ? {
                label: 'Nuevo material',
                href: '/materiales/nuevo',
                icon: IconPlus,
              }
            : undefined
        }
      />

      {error && (
        <div className="card border-red-300 bg-red-50 text-red-700 mb-4">
          No se pudo cargar el catálogo. Revisa tu conexión.
        </div>
      )}

      <div className="space-y-8">
        {porCategoria.map((grupo) => {
          const porSub = new Map<string, CatalogoMaterial[]>()
          for (const m of grupo.items) {
            const key = m.subcategoria ?? 'Sin subcategoría'
            const arr = porSub.get(key) ?? []
            arr.push(m)
            porSub.set(key, arr)
          }

          return (
            <section key={grupo.categoria}>
              <h2 className="text-lg font-bold text-ink mb-3">{grupo.categoria}</h2>
              {[...porSub.entries()].map(([sub, items]) => (
                <div key={sub} className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    {sub}
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {items.map((m) => (
                      <MaterialCard key={m.id} m={m} puedeEditar={puedeEditar} verPrecios={verPrecios} />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )
        })}

        {sinCategoria.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-ink mb-3">Sin categoría</h2>
            <div className="grid grid-cols-2 gap-3">
              {sinCategoria.map((m) => (
                <MaterialCard key={m.id} m={m} puedeEditar={puedeEditar} verPrecios={verPrecios} />
              ))}
            </div>
          </section>
        )}
      </div>

      {lista.length === 0 && (
        <EmptyState
          icon={IconPaquete}
          title="El catálogo está vacío"
          description="Aún no se han dado de alta materiales en el catálogo."
          action={
            puedeEditar
              ? {
                  label: 'Nuevo material',
                  href: '/materiales/nuevo',
                  icon: IconPlus,
                }
              : undefined
          }
        />
      )}
    </main>
  )
}
