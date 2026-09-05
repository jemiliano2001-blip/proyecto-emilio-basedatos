import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { MaterialForm } from '@/components/MaterialForm'
import { createMaterialAction } from '@/lib/actions/materiales'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarCatalogo } from '@/lib/roles'

export default async function NuevoMaterialPage() {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarCatalogo(session.rol)) {
    redirect('/materiales')
  }

  return (
    <main className="page-shell">
      <PageHeader
        title="Nuevo material"
        backHref="/materiales"
        backLabel="Volver al catálogo"
      />
      <MaterialForm action={createMaterialAction} submitLabel="Crear material" />
    </main>
  )
}
