export interface ProveedorInput {
  nombre: string
  contacto: string | null
  telefono: string | null
  rfc: string | null
  correo: string | null
  direccion: string | null
  condiciones_pago: string | null
  activo: boolean
}

// Mismos formatos que los checks de la migración 0049.
const RFC = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/
const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

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

  const rfc = trimOrNull(body.rfc)?.replace(/\s+/g, '').toUpperCase() ?? null
  if (rfc && !RFC.test(rfc)) {
    return { ok: false, error: 'El RFC no es válido. Debe tener 12 o 13 caracteres, por ejemplo ABC010203XY1.' }
  }
  const correo = trimOrNull(body.correo)?.toLowerCase() ?? null
  if (correo && (correo.length > 254 || !CORREO.test(correo))) {
    return { ok: false, error: 'El correo no es válido. Ejemplo: ventas@proveedor.com.' }
  }
  const direccion = trimOrNull(body.direccion)
  if (direccion && direccion.length > 500) {
    return { ok: false, error: 'La dirección es demasiado larga (máximo 500 caracteres).' }
  }
  const condiciones_pago = trimOrNull(body.condiciones_pago)
  if (condiciones_pago && condiciones_pago.length > 200) {
    return { ok: false, error: 'Las condiciones de pago son demasiado largas (máximo 200 caracteres).' }
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
      rfc,
      correo,
      direccion,
      condiciones_pago,
      activo,
    },
  }
}
