import Link from 'next/link'
import { redirect } from 'next/navigation'
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
      <header className="mb-6 pt-4">
        <Link href="/materiales" className="text-sm text-[#1E7F7A] font-medium">
          ← Volver al catálogo
        </Link>
        <h1 className="text-2xl font-bold text-[#132A45] mt-2">Nuevo material</h1>
      </header>
      <MaterialForm action={createMaterialAction} submitLabel="Crear material" />
    </main>
  )
}
