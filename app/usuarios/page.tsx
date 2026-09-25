import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { MatrizPermisosRoles } from '@/components/MatrizPermisosRoles'
import { IconChevron, IconPlus, IconUsuarios } from '@/components/icons'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarUsuarios } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { etiquetaRol } from '@/lib/validations/usuarios'
import type { Usuario } from '@/lib/types'

export default async function UsuariosPage() {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarUsuarios(session.rol)) {
    redirect('/')
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, email, rol, activo, creado_en')
    .order('nombre')

  const lista = (data as Usuario[] | null) ?? []

  return (
    <main className="page-shell space-y-6">
      <PageHeader
        title="Usuarios"
        description="Altas, roles y cuentas activas. Solo acceso total."
        action={{
          label: 'Nuevo usuario',
          href: '/usuarios/nuevo',
          icon: IconPlus,
        }}
      />

      {error && (
        <div className="card border-danger/40 bg-danger-soft text-danger-soft-foreground mb-4">
          No se pudieron cargar los usuarios.
          {error.message.includes('email') || error.code === '42703'
            ? ' ¿Ya aplicaste la migración 0024?'
            : ''}
        </div>
      )}

      {lista.length === 0 && !error ? (
        <EmptyState
          icon={IconUsuarios}
          title="No hay usuarios"
          description="Crea la primera cuenta para alguien del equipo."
          action={{
            label: 'Nuevo usuario',
            href: '/usuarios/nuevo',
            icon: IconPlus,
          }}
        />
      ) : (
        <div className="list-stack">
          <div className="list-header lg:grid-cols-[2.5rem_minmax(0,1.2fr)_minmax(0,1.4fr)_8rem_6rem_1.5rem]">
            <span />
            <span>Nombre</span>
            <span>Correo</span>
            <span>Rol</span>
            <span>Estatus</span>
            <span />
          </div>
          {lista.map((u) => (
            <Link
              key={u.id}
              href={`/usuarios/${u.id}`}
              className="list-row group items-center lg:grid lg:grid-cols-[2.5rem_minmax(0,1.2fr)_minmax(0,1.4fr)_8rem_6rem_1.5rem] lg:gap-3"
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-foreground"
                aria-hidden
              >
                {iniciales(u.nombre)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary">{u.nombre}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground lg:hidden">
                  {[u.email, etiquetaRol(u.rol)].filter(Boolean).join(' · ')}
                </p>
              </div>
              <p className="hidden min-w-0 truncate text-sm text-muted-foreground lg:block">{u.email ?? '—'}</p>
              <div className="hidden lg:block">
                <Badge variant={u.rol === 'acceso_total' ? 'info' : 'neutral'}>{etiquetaRol(u.rol)}</Badge>
              </div>
              <div className="shrink-0">
                {u.activo ? (
                  <Badge variant="success" dot className="hidden lg:inline-flex">
                    Activo
                  </Badge>
                ) : (
                  <Badge variant="neutral">Inactivo</Badge>
                )}
              </div>
              <IconChevron className="hidden size-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary lg:block" />
            </Link>
          ))}
        </div>
      )}

      <div className="pt-2">
        <MatrizPermisosRoles />
      </div>
    </main>
  )
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase()
  return nombre.slice(0, 2).toUpperCase()
}
