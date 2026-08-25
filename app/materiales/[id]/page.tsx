import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
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
      <header className="mb-6 pt-4">
        <Link href="/materiales" className="text-sm text-[#1E7F7A] font-medium">
          ← Volver al catálogo
        </Link>
        <h1 className="text-2xl font-bold text-[#132A45] mt-2">Editar material</h1>
      </header>
      <MaterialForm
        action={updateAction}
        material={material as CatalogoMaterial}
        submitLabel="Guardar cambios"
      />
    </main>
  )
}
