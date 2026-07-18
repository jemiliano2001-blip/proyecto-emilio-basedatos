import { parseQuantity } from '@/lib/money'

export interface TopeInput {
  obra_id: string
  material_id: string
  cantidad_contratada: number
}

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function validateTopeInput(raw: unknown): ValidationResult<TopeInput> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Datos de tope inválidos.' }
  }

  const body = raw as Record<string, unknown>
  const obra_id = typeof body.obra_id === 'string' ? body.obra_id.trim() : ''
  const material_id = typeof body.material_id === 'string' ? body.material_id.trim() : ''

  if (!UUID_RE.test(obra_id)) {
    return { ok: false, error: 'Obra no válida.' }
  }
  if (!UUID_RE.test(material_id)) {
    return { ok: false, error: 'Selecciona un material del catálogo.' }
  }

  const cantidadRaw =
    typeof body.cantidad_contratada === 'number'
      ? String(body.cantidad_contratada)
      : typeof body.cantidad_contratada === 'string'
        ? body.cantidad_contratada
        : ''

  const cantidad = parseQuantity(cantidadRaw)
  if (cantidad === null) {
    return { ok: false, error: 'La cantidad contratada debe ser un número válido.' }
  }
  if (cantidad < 0) {
    return { ok: false, error: 'La cantidad contratada no puede ser negativa.' }
  }
  if (cantidad > 9999999999.99) {
    return { ok: false, error: 'La cantidad contratada es demasiado grande.' }
  }

  return {
    ok: true,
    data: {
      obra_id,
      material_id,
      cantidad_contratada: cantidad,
    },
  }
}
