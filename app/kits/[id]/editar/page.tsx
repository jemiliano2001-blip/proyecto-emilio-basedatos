import { redirect, notFound } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { KitForm } from '@/components/KitForm'
import { updateKitAction } from '@/lib/actions/kits'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarKits } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { CatalogoMaterial } from '@/lib/types'

export default async function EditarKitPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedparams = await params
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarKits(session.rol)) {
    redirect('/kits')
  }

  const supabase = await createClient()

  // Consulta del kit y sus componentes
  const { data: kit } = await supabase
    .from('material_kits')
    .select(`
      id,
      nombre,
      material_principal_id,
      configuracion,
      descripcion,
      activo,
      material_kit_items (
        id,
        material_id,
        cantidad
      )
    `)
    .eq('id', resolvedparams.id)
    .maybeSingle()

  if (!kit) notFound()

  // Consulta de materiales activos para los selectores
  const { data: materialesRaw } = await supabase
    .from('catalogo_materiales')
    .select('id, nombre_base, variante, unidad_medida, categoria, subcategoria, precio_base, activo')
    .eq('activo', true)
    .order('nombre_base')

  const materiales = (materialesRaw as CatalogoMaterial[] | null) ?? []
  const updateAction = updateKitAction.bind(null, kit.id)

  const kitInitial = {
    id: kit.id,
    nombre: kit.nombre,
    material_principal_id: kit.material_principal_id,
    configuracion: kit.configuracion,
    descripcion: kit.descripcion,
    activo: kit.activo,
    items: (kit.material_kit_items as Array<{ material_id: string; cantidad: number }>)?.map(
      (it) => ({
        material_id: it.material_id,
        cantidad: it.cantidad,
      })
    ),
  }

  return (
    <main className="page-shell space-y-6">
      <PageHeader
        title="Editar Plantilla de Kit"
        subtitle={kit.nombre}
        description="Modifica la configuración, equipo principal o los componentes menores del ensamble."
        backHref="/kits"
        backLabel="Volver a Kits"
      />

      <KitForm
        action={updateAction}
        materiales={materiales}
        kit={kitInitial}
        submitLabel="Guardar cambios"
      />
    </main>
  )
}
