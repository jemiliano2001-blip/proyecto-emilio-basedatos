import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { RolUsuario, Usuario } from '@/lib/types'

export interface SessionUsuario {
  authUserId: string
  email: string | undefined
  perfil: Usuario | null
  rol: RolUsuario | null
}

const ROLES: readonly RolUsuario[] = [
  'personal',
  'compras',
  'proyectos',
  'operacion',
  'finanzas',
  'acceso_total',
]

function asRol(value: unknown): RolUsuario | null {
  if (typeof value !== 'string') return null
  return ROLES.includes(value as RolUsuario) ? (value as RolUsuario) : null
}

export const getSessionUsuario = cache(async (): Promise<SessionUsuario | null> => {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: perfil } = await supabase
    .from('usuarios')
    .select('id, nombre, rol, activo')
    .eq('id', user.id)
    .maybeSingle()

  if (!perfil) {
    return {
      authUserId: user.id,
      email: user.email,
      perfil: null,
      rol: null,
    }
  }

  const rolDb = asRol(perfil.rol)
  if (!rolDb) {
    return {
      authUserId: user.id,
      email: user.email,
      perfil: null,
      rol: null,
    }
  }

  const usuario: Usuario = {
    id: perfil.id,
    nombre: perfil.nombre,
    rol: rolDb,
    activo: perfil.activo,
  }

  return {
    authUserId: user.id,
    email: user.email,
    perfil: usuario,
    rol: perfil.activo === false ? null : rolDb,
  }
})

export async function requireSessionUsuario(): Promise<SessionUsuario> {
  const session = await getSessionUsuario()
  if (!session) {
    throw new Error('No autenticado')
  }
  return session
}
