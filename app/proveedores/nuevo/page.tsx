import Link from 'next/link'
import { redirect } from 'next/navigation'
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
    <main className="page-shell">
      <header className="mb-6 pt-4">
        <Link href="/proveedores" className="text-sm text-[#1E7F7A] font-medium">
          ← Proveedores
        </Link>
        <h1 className="text-2xl font-bold text-[#132A45] mt-2">Nuevo proveedor</h1>
      </header>
      <ProveedorForm action={createProveedorAction} submitLabel="Crear proveedor" />
    </main>
  )
}
