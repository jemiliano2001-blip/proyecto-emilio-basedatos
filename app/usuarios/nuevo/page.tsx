import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { UsuarioCrearForm } from '@/components/UsuarioForms'
import { crearUsuarioAction } from '@/lib/actions/usuarios'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarUsuarios } from '@/lib/roles'

export default async function NuevoUsuarioPage() {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarUsuarios(session.rol)) {
    redirect('/')
  }

  return (
    <main className="page-shell">
      <PageHeader
        title="Nuevo usuario"
        description="Se crea la cuenta de login y el perfil con rol."
        backHref="/usuarios"
        backLabel="Usuarios"
      />
      <div className="card">
        <UsuarioCrearForm action={crearUsuarioAction} />
      </div>
    </main>
  )
}
