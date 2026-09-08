import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { MaterialForm } from '@/components/MaterialForm'
import { createMaterialAction } from '@/lib/actions/materiales'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarCatalogo } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { MaterialCategoria } from '@/lib/types'

export default async function NuevoMaterialPage({
  searchParams,
}: {
  searchParams?: Promise<{ categoria?: string; subcategoria?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarCatalogo(session.rol)) {
    redirect('/materiales')
  }

  const supabase = await createClient()
  const { data: categoriasRaw } = await supabase
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

  const categorias = (categoriasRaw as MaterialCategoria[] | null) ?? []

  return (
    <main className="page-shell">
      <PageHeader
        title="Nuevo material"
        backHref="/materiales"
        backLabel="Volver al catálogo"
      />
      <MaterialForm
        action={createMaterialAction}
        submitLabel="Crear material"
        categorias={categorias}
        initialCategoria={resolvedSearchParams?.categoria}
        initialSubcategoria={resolvedSearchParams?.subcategoria}
      />
    </main>
  )
}
