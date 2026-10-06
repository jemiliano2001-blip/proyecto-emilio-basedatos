import { notFound, redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { MatrizPermisosRoles } from '@/components/MatrizPermisosRoles'
import { UsuarioProyectosForm } from '@/components/UsuarioProyectosForm'
import {
  UsuarioEditarForm,
  UsuarioResetPasswordForm,
} from '@/components/UsuarioForms'
import {
  actualizarUsuarioAction,
  resetPasswordUsuarioAction,
  asignarProyectosUsuarioAction,
} from '@/lib/actions/usuarios'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarUsuarios } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { etiquetaRol } from '@/lib/validations/usuarios'
import { Badge } from '@/components/Badge'
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
  const [proyectos, asignaciones] = usuario.rol === 'personal' ? await Promise.all([
    supabase.from('obras_lectura').select('id,nombre,estado').order('nombre'),
    supabase.from('usuario_obras').select('obra_id').eq('usuario_id', usuario.id),
  ]) : [null, null]

  return (
    <main className="page-shell-narrow space-y-6">
      <PageHeader
        eyebrow={etiquetaRol(usuario.rol)}
        title={usuario.nombre}
        badge={
          <Badge variant={usuario.activo ? 'success' : 'neutral'} dot>
            {usuario.activo ? 'Activo' : 'Inactivo'}
          </Badge>
        }
        description={usuario.email ?? undefined}
        backHref="/usuarios"
        backLabel="Usuarios"
      />

      <section className="card space-y-3">
        <h2 className="t-h2">Datos y rol</h2>
        <UsuarioEditarForm
          usuario={usuario}
          action={boundUpdate}
          esYo={usuario.id === session.authUserId}
        />
      </section>

      <section className="card space-y-3">
        <h2 className="t-h2">Contraseña</h2>
        <p className="text-sm text-muted-foreground">
          Genera una temporal o escribe una nueva. Se muestra una sola vez en
          pantalla.
        </p>
        <UsuarioResetPasswordForm action={boundReset} />
      </section>

      {usuario.rol === 'personal' && <section className="card space-y-3">
        <h2 className="t-h2">Proyectos asignados</h2>
        {proyectos?.error || asignaciones?.error
          ? <p role="alert" className="text-sm text-danger">No se pudieron cargar las asignaciones. Verifica la migración 0034 y reintenta.</p>
          : <UsuarioProyectosForm proyectos={proyectos?.data ?? []} asignados={(asignaciones?.data ?? []).map(a => a.obra_id)} action={asignarProyectosUsuarioAction.bind(null, usuario.id)} />}
      </section>}

      <section className="space-y-3">
        <MatrizPermisosRoles rolInicial={usuario.rol} />
      </section>
    </main>
  )
}
