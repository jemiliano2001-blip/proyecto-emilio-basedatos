import { redirect, notFound } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { MaterialForm } from '@/components/MaterialForm'
import { updateMaterialAction } from '@/lib/actions/materiales'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarCatalogo } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { CatalogoMaterial } from '@/lib/types'

export default async function EditarMaterialPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarCatalogo(session.rol)) {
    redirect('/materiales')
  }

  const supabase = createClient()
  const { data: material } = await supabase
    .from('catalogo_materiales')
    .select(
      'id, nombre_base, variante, unidad_medida, categoria, subcategoria, especificacion, foto_url, activo'
    )
    .eq('id', params.id)
    .maybeSingle()

  if (!material) notFound()

  const updateAction = updateMaterialAction.bind(null, params.id)

  return (
    <main className="page-shell">
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
      />
    </main>
  )
}
