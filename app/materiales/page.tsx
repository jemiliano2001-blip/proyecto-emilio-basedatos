import Link from 'next/link'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarCatalogo } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { CatalogoMaterial } from '@/lib/types'

export default async function MaterialesPage() {
  const session = await getSessionUsuario()
  const puedeEditar = puedeGestionarCatalogo(session?.rol ?? null)
  const supabase = createClient()

  const { data: materiales, error } = await supabase
    .from('catalogo_materiales')
    .select(
      'id, nombre_base, variante, unidad_medida, categoria, subcategoria, especificacion, foto_url, activo'
    )
    .eq('activo', true)
    .order('nombre_base')

  return (
    <main className="max-w-2xl mx-auto p-4 pb-28">
      <header className="mb-6 pt-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#132A45]">Catálogo de materiales</h1>
          <p className="text-gray-500 text-sm">
            Identifica cada material por nombre o foto
          </p>
        </div>
        {puedeEditar && (
          <Link
            href="/materiales/nuevo"
            className="btn-primary shrink-0 text-sm py-2 px-4"
          >
            Nuevo
          </Link>
        )}
      </header>

      {error && (
        <div className="card border-red-300 bg-red-50 text-red-700 mb-4">
          No se pudo cargar el catálogo. Revisa tu conexión.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {(materiales as CatalogoMaterial[] | null)?.map((m) => {
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
              <p className="font-medium text-sm">{m.nombre_base}</p>
              {m.variante && <p className="text-xs text-gray-500">{m.variante}</p>}
              <p className="text-xs text-gray-400 mt-1">{m.unidad_medida}</p>
            </>
          )

          return puedeEditar ? (
            <Link key={m.id} href={`/materiales/${m.id}`} className="card block">
              {body}
            </Link>
          ) : (
            <div key={m.id} className="card">
              {body}
            </div>
          )
        })}
      </div>

      {materiales?.length === 0 && (
        <p className="text-gray-500 text-center py-8">
          El catálogo está vacío — se llena con la lista de Manuel.
        </p>
      )}
    </main>
  )
}
