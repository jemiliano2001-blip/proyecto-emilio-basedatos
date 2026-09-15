import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { IconPlus, IconUsuarios } from '@/components/icons'
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
    <main className="page-shell">
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
        <div className="card border-red-300 bg-red-50 text-red-700 mb-4">
          No se pudieron cargar los usuarios.
          {error.message.includes('email') || error.code === '42703'
            ? ' ¿Ya aplicaste la migración 0024?'
            : ''}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
        {lista.map((u) => (
          <Link
            key={u.id}
            href={`/usuarios/${u.id}`}
            className="flex min-h-[56px] items-start justify-between gap-3 px-3.5 py-3 hover:bg-slate-50 transition-colors"
          >
            <div className="min-w-0">
              <p className="font-semibold text-ink">{u.nombre}</p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {[u.email, etiquetaRol(u.rol)].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {!u.activo && <Badge variant="gray">Inactivo</Badge>}
              {u.rol === 'acceso_total' && u.activo && (
                <Badge variant="teal">Acceso total</Badge>
              )}
            </div>
          </Link>
        ))}
        {lista.length === 0 && !error && (
          <div className="p-4">
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
          </div>
        )}
      </div>
    </main>
  )
}
