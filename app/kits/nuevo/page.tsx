import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { KitForm } from '@/components/KitForm'
import { createKitAction } from '@/lib/actions/kits'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarKits } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { CatalogoMaterial } from '@/lib/types'

export default async function NuevoKitPage() {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarKits(session.rol)) {
    redirect('/kits')
  }

  const supabase = await createClient()
  const { data: materialesRaw } = await supabase
    .from('catalogo_materiales')
    .select('id, nombre_base, variante, unidad_medida, categoria, subcategoria, precio_base, activo')
    .eq('activo', true)
    .order('nombre_base')

  const materiales = (materialesRaw as CatalogoMaterial[] | null) ?? []

  return (
    <main className="page-shell space-y-6">
      <PageHeader
        title="Nueva Plantilla de Kit"
        description="Define un equipo principal con su configuración y el conjunto de accesorios menores asociados."
        backHref="/kits"
        backLabel="Volver a Kits"
      />

      <KitForm action={createKitAction} materiales={materiales} submitLabel="Guardar Kit / Ensamble" />
    </main>
  )
}
