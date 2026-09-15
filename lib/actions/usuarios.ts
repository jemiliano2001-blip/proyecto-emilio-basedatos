'use server'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarUsuarios } from '@/lib/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  validateActualizarUsuarioInput,
  validateCrearUsuarioInput,
  validateResetPasswordInput,
} from '@/lib/validations/usuarios'

export type UsuarioActionResult = {
  error: string | null
  ok?: boolean
  passwordTemporal?: string
  usuarioId?: string
}

const BAN_LARGO = '876000h' // ~100 años

function generarPasswordTemporal(): string {
  // 18 bytes → ~24 chars base64url, sin caracteres ambiguos problemáticos
  return randomBytes(18).toString('base64url')
}

async function requireAdminUsuarios(): Promise<
  | { ok: true; authUserId: string }
  | { ok: false; error: string }
> {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarUsuarios(session.rol)) {
    return { ok: false, error: 'No tienes permiso para gestionar usuarios.' }
  }
  return { ok: true, authUserId: session.authUserId }
}

async function contarAccesoTotalActivos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  excludeId?: string
): Promise<number> {
  let query = supabase
    .from('usuarios')
    .select('id', { count: 'exact', head: true })
    .eq('rol', 'acceso_total')
    .eq('activo', true)

  if (excludeId) {
    query = query.neq('id', excludeId)
  }

  const { count, error } = await query
  if (error) {
    throw new Error('No se pudo verificar administradores activos.')
  }
  return count ?? 0
}

export async function crearUsuarioAction(
  _prev: UsuarioActionResult,
  formData: FormData
): Promise<UsuarioActionResult> {
  const gate = await requireAdminUsuarios()
  if (!gate.ok) return { error: gate.error }

  const parsed = validateCrearUsuarioInput({
    email: formData.get('email'),
    nombre: formData.get('nombre'),
    rol: formData.get('rol'),
    password: formData.get('password'),
  })
  if (!parsed.ok) return { error: parsed.error }

  const passwordFinal = parsed.data.password ?? generarPasswordTemporal()
  const passwordFueGenerada = parsed.data.password === null

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return {
      error:
        'Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor. Pídeselo a quien administra el entorno.',
    }
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: passwordFinal,
    email_confirm: true,
    user_metadata: { nombre: parsed.data.nombre },
  })

  if (createError || !created.user) {
    const msg = createError?.message?.toLowerCase() ?? ''
    if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
      return { error: 'Ya existe una cuenta con ese correo.' }
    }
    return { error: 'No se pudo crear la cuenta. Intenta de nuevo.' }
  }

  const userId = created.user.id
  const supabase = await createClient()
  const { error: insertError } = await supabase.from('usuarios').insert({
    id: userId,
    email: parsed.data.email,
    nombre: parsed.data.nombre,
    rol: parsed.data.rol,
    activo: true,
  })

  if (insertError) {
    await admin.auth.admin.deleteUser(userId)
    if (insertError.code === '23505') {
      return { error: 'Ya existe un usuario con ese correo.' }
    }
    return {
      error:
        'Se creó la cuenta Auth pero no el perfil. Se revirtió el alta. ¿Ya aplicaste la migración 0024?',
    }
  }

  revalidatePath('/usuarios')
  revalidatePath('/bitacora')

  return {
    error: null,
    ok: true,
    usuarioId: userId,
    passwordTemporal: passwordFueGenerada ? passwordFinal : undefined,
  }
}

export async function actualizarUsuarioAction(
  usuarioId: string,
  _prev: UsuarioActionResult,
  formData: FormData
): Promise<UsuarioActionResult> {
  const gate = await requireAdminUsuarios()
  if (!gate.ok) return { error: gate.error }

  if (!usuarioId || typeof usuarioId !== 'string') {
    return { error: 'Usuario inválido.' }
  }

  const parsed = validateActualizarUsuarioInput({
    nombre: formData.get('nombre'),
    rol: formData.get('rol'),
    activo: formData.get('activo'),
  })
  if (!parsed.ok) return { error: parsed.error }

  if (usuarioId === gate.authUserId && !parsed.data.activo) {
    return { error: 'No puedes desactivar tu propia cuenta.' }
  }

  const supabase = await createClient()
  const { data: actual, error: loadError } = await supabase
    .from('usuarios')
    .select('id, rol, activo')
    .eq('id', usuarioId)
    .maybeSingle()

  if (loadError || !actual) {
    return { error: 'No se encontró el usuario.' }
  }

  const pierdeAccesoTotal =
    actual.rol === 'acceso_total' &&
    actual.activo === true &&
    (parsed.data.rol !== 'acceso_total' || parsed.data.activo === false)

  if (pierdeAccesoTotal) {
    try {
      const restantes = await contarAccesoTotalActivos(supabase, usuarioId)
      if (restantes < 1) {
        return {
          error:
            'Debe quedar al menos un usuario con acceso total activo. Asigna ese rol a otra persona antes.',
        }
      }
    } catch {
      return { error: 'No se pudo verificar administradores activos.' }
    }
  }

  const { error: updateError } = await supabase
    .from('usuarios')
    .update({
      nombre: parsed.data.nombre,
      rol: parsed.data.rol,
      activo: parsed.data.activo,
    })
    .eq('id', usuarioId)

  if (updateError) {
    const msg = updateError.message.toLowerCase()
    if (msg.includes('acceso total') || updateError.code === 'P0001') {
      return {
        error:
          'Debe quedar al menos un usuario con acceso total activo. Asigna ese rol a otra persona antes.',
      }
    }
    return {
      error:
        'No se pudo actualizar el usuario. ¿Ya aplicaste la migración 0024?',
    }
  }

  // Sincronizar ban en Auth para que no pueda iniciar sesión si está inactivo
  try {
    const admin = createAdminClient()
    const { error: banError } = await admin.auth.admin.updateUserById(usuarioId, {
      ban_duration: parsed.data.activo ? 'none' : BAN_LARGO,
    })
    if (banError) {
      // Perfil ya actualizado; reportar pero no revertir (activo en app es la fuente)
      return {
        error: null,
        ok: true,
        usuarioId,
      }
    }
  } catch {
    // Sin service_role: el perfil ya bloquea vía activo=false en sesión
  }

  revalidatePath('/usuarios')
  revalidatePath(`/usuarios/${usuarioId}`)
  revalidatePath('/bitacora')

  return { error: null, ok: true, usuarioId }
}

export async function resetPasswordUsuarioAction(
  usuarioId: string,
  _prev: UsuarioActionResult,
  formData: FormData
): Promise<UsuarioActionResult> {
  const gate = await requireAdminUsuarios()
  if (!gate.ok) return { error: gate.error }

  if (!usuarioId || typeof usuarioId !== 'string') {
    return { error: 'Usuario inválido.' }
  }

  const parsed = validateResetPasswordInput({
    password: formData.get('password'),
  })
  if (!parsed.ok) return { error: parsed.error }

  const supabase = await createClient()
  const { data: actual, error: loadError } = await supabase
    .from('usuarios')
    .select('id, activo')
    .eq('id', usuarioId)
    .maybeSingle()

  if (loadError || !actual) {
    return { error: 'No se encontró el usuario.' }
  }
  if (!actual.activo) {
    return { error: 'Reactiva al usuario antes de resetear su contraseña.' }
  }

  const passwordFinal = parsed.data.password ?? generarPasswordTemporal()
  const passwordFueGenerada = parsed.data.password === null

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return {
      error:
        'Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor.',
    }
  }

  const { error } = await admin.auth.admin.updateUserById(usuarioId, {
    password: passwordFinal,
  })

  if (error) {
    return { error: 'No se pudo cambiar la contraseña. Intenta de nuevo.' }
  }

  revalidatePath(`/usuarios/${usuarioId}`)

  return {
    error: null,
    ok: true,
    usuarioId,
    passwordTemporal: passwordFueGenerada ? passwordFinal : undefined,
  }
}
