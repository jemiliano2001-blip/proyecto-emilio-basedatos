import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { ProveedorForm } from '@/components/ProveedorForm'
import { createProveedorAction } from '@/lib/actions/proveedores'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarProveedores } from '@/lib/roles'

export default async function NuevoProveedorPage() {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarProveedores(session.rol)) {
    redirect('/proveedores')
  }

  return (
    <main className="page-shell-narrow">
      <PageHeader
        title="Nuevo proveedor"
        backHref="/proveedores"
        backLabel="Proveedores"
      />
      <ProveedorForm action={createProveedorAction} submitLabel="Crear proveedor" />
    </main>
  )
}
