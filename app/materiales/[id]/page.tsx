import { redirect, notFound } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { MaterialForm } from '@/components/MaterialForm'
import { updateMaterialAction } from '@/lib/actions/materiales'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarCatalogo } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { CatalogoMaterial, MaterialCategoria } from '@/lib/types'

export default async function EditarMaterialPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedparams = await params
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarCatalogo(session.rol)) {
    redirect('/materiales')
  }

  const supabase = await createClient()
  const { data: material } = await supabase
    .from('catalogo_materiales')
    .select(
      'id, nombre_base, variante, unidad_medida, categoria, subcategoria, especificacion, foto_url, precio_base, activo'
    )
    .eq('id', resolvedparams.id)
    .maybeSingle()

  if (!material) notFound()

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
  const updateAction = updateMaterialAction.bind(null, resolvedparams.id)

  return (
    <main className="page-shell-narrow">
      <PageHeader
        title="Editar material"
        subtitle={material.nombre_base}
        backHref="/materiales"
        backLabel="Volver al catálogo"
      />
      <MaterialForm
        action={updateAction}
        material={material as CatalogoMaterial}
        submitLabel="Guardar cambios"
        categorias={categorias}
      />
    </main>
  )
}
