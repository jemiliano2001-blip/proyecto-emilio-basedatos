import type { RolUsuario } from '@/lib/types'

export const ROLES_USUARIO: readonly RolUsuario[] = [
  'personal',
  'compras',
  'proyectos',
  'operacion',
  'finanzas',
  'acceso_total',
] as const

export interface CrearUsuarioInput {
  email: string
  nombre: string
  rol: RolUsuario
  password: string | null
}

export interface ActualizarUsuarioInput {
  email?: string
  nombre: string
  rol: RolUsuario
  activo: boolean
}

export interface ResetPasswordInput {
  password: string | null
}

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function asRol(value: unknown): RolUsuario | null {
  if (typeof value !== 'string') return null
  return ROLES_USUARIO.includes(value as RolUsuario)
    ? (value as RolUsuario)
    : null
}

function parsePasswordOpcional(value: unknown): ValidationResult<string | null> {
  if (value === null || value === undefined) return { ok: true, data: null }
  if (typeof value !== 'string') {
    return { ok: false, error: 'La contraseña no es válida.' }
  }
  const trimmed = value.trim()
  if (trimmed === '') return { ok: true, data: null }
  if (trimmed.length < 8) {
    return { ok: false, error: 'La contraseña debe tener al menos 8 caracteres.' }
  }
  if (trimmed.length > 72) {
    return { ok: false, error: 'La contraseña es demasiado larga.' }
  }
  return { ok: true, data: trimmed }
}

export function validateCrearUsuarioInput(
  raw: unknown
): ValidationResult<CrearUsuarioInput> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Datos de usuario inválidos.' }
  }

  const body = raw as Record<string, unknown>
  const emailRaw = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''
  const rol = asRol(body.rol)

  if (!emailRaw || !EMAIL_RE.test(emailRaw)) {
    return { ok: false, error: 'Escribe un correo válido.' }
  }
  if (emailRaw.length > 254) {
    return { ok: false, error: 'El correo es demasiado largo.' }
  }
  if (nombre.length < 2) {
    return { ok: false, error: 'El nombre debe tener al menos 2 caracteres.' }
  }
  if (nombre.length > 120) {
    return { ok: false, error: 'El nombre es demasiado largo.' }
  }
  if (!rol) {
    return { ok: false, error: 'Elige un rol válido.' }
  }

  const passwordParsed = parsePasswordOpcional(body.password)
  if (!passwordParsed.ok) return passwordParsed

  return {
    ok: true,
    data: {
      email: emailRaw,
      nombre,
      rol,
      password: passwordParsed.data,
    },
  }
}

export function validateActualizarUsuarioInput(
  raw: unknown
): ValidationResult<ActualizarUsuarioInput> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Datos de usuario inválidos.' }
  }

  const body = raw as Record<string, unknown>
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''
  const emailRaw = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const rol = asRol(body.rol)
  const activo =
    typeof body.activo === 'boolean'
      ? body.activo
      : body.activo === 'false'
        ? false
        : body.activo === 'true'
          ? true
          : null

  if (emailRaw && !EMAIL_RE.test(emailRaw)) {
    return { ok: false, error: 'Escribe un correo válido.' }
  }
  if (emailRaw && emailRaw.length > 254) {
    return { ok: false, error: 'El correo es demasiado largo.' }
  }
  if (nombre.length < 2) {
    return { ok: false, error: 'El nombre debe tener al menos 2 caracteres.' }
  }
  if (nombre.length > 120) {
    return { ok: false, error: 'El nombre es demasiado largo.' }
  }
  if (!rol) {
    return { ok: false, error: 'Elige un rol válido.' }
  }
  if (activo === null) {
    return { ok: false, error: 'Indica si el usuario está activo.' }
  }

  return {
    ok: true,
    data: {
      nombre,
      rol,
      activo,
      ...(emailRaw ? { email: emailRaw } : {}),
    },
  }
}

export function validateResetPasswordInput(
  raw: unknown
): ValidationResult<ResetPasswordInput> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Datos inválidos.' }
  }
  const body = raw as Record<string, unknown>
  const passwordParsed = parsePasswordOpcional(body.password)
  if (!passwordParsed.ok) return passwordParsed
  return { ok: true, data: { password: passwordParsed.data } }
}

export function etiquetaRol(rol: RolUsuario): string {
  switch (rol) {
    case 'personal':
      return 'Personal'
    case 'compras':
      return 'Compras'
    case 'proyectos':
      return 'Proyectos'
    case 'operacion':
      return 'Operación'
    case 'finanzas':
      return 'Finanzas'
    case 'acceso_total':
      return 'Acceso total'
    default: {
      const _exhaustive: never = rol
      return _exhaustive
    }
  }
}
