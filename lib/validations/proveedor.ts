export interface ProveedorInput {
  nombre: string
  contacto: string | null
  telefono: string | null
  activo: boolean
}

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

function trimOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export function validateProveedorInput(raw: unknown): ValidationResult<ProveedorInput> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Datos de proveedor inválidos.' }
  }

  const body = raw as Record<string, unknown>
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''

  if (nombre.length < 2) {
    return { ok: false, error: 'El nombre del proveedor debe tener al menos 2 caracteres.' }
  }
  if (nombre.length > 200) {
    return { ok: false, error: 'El nombre del proveedor es demasiado largo.' }
  }

  const activo =
    typeof body.activo === 'boolean'
      ? body.activo
      : body.activo === 'false'
        ? false
        : true

  return {
    ok: true,
    data: {
      nombre,
      contacto: trimOrNull(body.contacto),
      telefono: trimOrNull(body.telefono),
      activo,
    },
  }
}
