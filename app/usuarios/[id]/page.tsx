import { notFound, redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import {
  UsuarioEditarForm,
  UsuarioResetPasswordForm,
} from '@/components/UsuarioForms'
import {
  actualizarUsuarioAction,
  resetPasswordUsuarioAction,
} from '@/lib/actions/usuarios'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarUsuarios } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { Usuario } from '@/lib/types'

export default async function UsuarioDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarUsuarios(session.rol)) {
    redirect('/')
  }

  const { id } = await params
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, email, rol, activo, creado_en')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) {
    notFound()
  }

  const usuario = data as Usuario
  const boundUpdate = actualizarUsuarioAction.bind(null, usuario.id)
  const boundReset = resetPasswordUsuarioAction.bind(null, usuario.id)

  return (
    <main className="page-shell-narrow space-y-6">
      <PageHeader
        title={usuario.nombre}
        description={usuario.email ?? undefined}
        backHref="/usuarios"
        backLabel="Usuarios"
      />

      <section className="card space-y-3">
        <h2 className="text-base font-bold text-foreground">Datos y rol</h2>
        <UsuarioEditarForm
          usuario={usuario}
          action={boundUpdate}
          esYo={usuario.id === session.authUserId}
        />
      </section>

      <section className="card space-y-3">
        <h2 className="text-base font-bold text-foreground">Contraseña</h2>
        <p className="text-sm text-muted-foreground">
          Genera una temporal o escribe una nueva. Se muestra una sola vez en
          pantalla.
        </p>
        <UsuarioResetPasswordForm action={boundReset} />
      </section>
    </main>
  )
}
