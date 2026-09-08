import { PageHeader } from '@/components/PageHeader'
import { IconPlus } from '@/components/icons'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarCatalogo, puedeVerPrecios } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { CatalogoMaterial, MaterialCategoria } from '@/lib/types'
import { CatalogoMaterialesView } from '@/components/CatalogoMaterialesView'

export default async function MaterialesPage({
  searchParams,
}: {
  searchParams?: Promise<{ categoria?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const session = await getSessionUsuario()
  const puedeEditar = puedeGestionarCatalogo(session?.rol ?? null)
  const verPrecios = puedeVerPrecios(session?.rol ?? null)
  const supabase = await createClient()

  // 1. Consulta de materiales activos
  const { data: materiales, error: errMateriales } = await supabase
    .from('catalogo_materiales')
    .select(
      'id, nombre_base, variante, unidad_medida, categoria, subcategoria, especificacion, foto_url, precio_base, activo'
    )
    .eq('activo', true)
    .order('nombre_base')

  // 2. Consulta de categorías dinámicas y sus subcategorías desde base de datos
  const { data: categoriasRaw, error: errCategorias } = await supabase
    .from('material_categorias')
    .select(`
      id,
      nombre,
      orden,
      creado_en,
      material_subcategorias (
        id,
        categoria_id,
        nombre,
        orden,
        creado_en
      )
    `)
    .order('orden', { ascending: true })

  const lista = (materiales as CatalogoMaterial[] | null) ?? []
  const categorias = (categoriasRaw as MaterialCategoria[] | null) ?? []

  return (
    <main className="page-shell space-y-6">
      <PageHeader
        title="Catálogo de materiales"
        description="Selecciona una categoría para desplegar sus subcategorías y materiales"
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

      {(errMateriales || errCategorias) && (
        <div className="card border-red-300 bg-red-50 text-red-700">
          No se pudo cargar la información completa del catálogo. Revisa tu conexión.
        </div>
      )}

      <CatalogoMaterialesView
        materiales={lista}
        categorias={categorias}
        puedeEditar={puedeEditar}
        verPrecios={verPrecios}
        initialCategoria={resolvedSearchParams?.categoria}
      />
    </main>
  )
}
