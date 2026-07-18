import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ObraForm } from '@/components/ObraForm'
import { createObraAction } from '@/lib/actions/obras'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarObras } from '@/lib/roles'

export default async function NuevaObraPage() {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarObras(session.rol)) {
    redirect('/')
  }

  return (
    <main className="max-w-2xl mx-auto p-4 pb-28">
      <header className="mb-6 pt-4">
        <Link href="/" className="text-sm text-[#1E7F7A] font-medium">
          ← Volver a obras
        </Link>
        <h1 className="text-2xl font-bold text-[#132A45] mt-2">Nueva obra</h1>
      </header>
      <ObraForm action={createObraAction} submitLabel="Crear obra" />
    </main>
  )
}
