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

  // Materiales activos + los que el kit ya usa aunque se hayan desactivado: si no, su select
  // queda sin opción válida y el formulario no deja guardar.
  const idsEnKit = [
    ...(kit.material_kit_items ?? []).map((it: { material_id: string }) => it.material_id),
    ...(kit.material_principal_id ? [kit.material_principal_id] : []),
  ]
  let materialesQuery = supabase
    .from('catalogo_materiales_lectura')
    .select('id, nombre_base, variante, unidad_medida, categoria, subcategoria, precio_base, activo')
    .order('nombre_base')
  materialesQuery =
    idsEnKit.length > 0
      ? materialesQuery.or(`activo.eq.true,id.in.(${idsEnKit.join(',')})`)
      : materialesQuery.eq('activo', true)
  const { data: materialesRaw } = await materialesQuery

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
    <main className="page-shell-narrow space-y-6">
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
