import { parseQuantity } from '@/lib/money'

export interface SolicitudItemInput {
  material_id: string
  cantidad_solicitada: number
  nota: string | null
}

export interface SolicitudInput {
  obra_id: string
  nota: string | null
  items: SolicitudItemInput[]
}

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MAX_ITEMS = 50

function trimOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function validateItem(raw: unknown, index: number): ValidationResult<SolicitudItemInput> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: `Rengl?n ${index + 1}: datos inv?lidos.` }
  }

  const body = raw as Record<string, unknown>
  const material_id = typeof body.material_id === 'string' ? body.material_id.trim() : ''

  if (!UUID_RE.test(material_id)) {
    return { ok: false, error: `Rengl?n ${index + 1}: selecciona un material.` }
  }

  const cantidadRaw =
    typeof body.cantidad_solicitada === 'number'
      ? String(body.cantidad_solicitada)
      : typeof body.cantidad_solicitada === 'string'
        ? body.cantidad_solicitada
        : ''

  const cantidad = parseQuantity(cantidadRaw)
  if (cantidad === null) {
    return { ok: false, error: `Rengl?n ${index + 1}: la cantidad debe ser un n?mero v?lido.` }
  }
  if (cantidad <= 0) {
    return { ok: false, error: `Rengl?n ${index + 1}: la cantidad debe ser mayor a cero.` }
  }
  if (cantidad > 9999999999.99) {
    return { ok: false, error: `Rengl?n ${index + 1}: la cantidad es demasiado grande.` }
  }

  return {
    ok: true,
    data: {
      material_id,
      cantidad_solicitada: cantidad,
      nota: trimOrNull(body.nota),
    },
  }
}

export function validateSolicitudInput(raw: unknown): ValidationResult<SolicitudInput> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Datos de solicitud inv?lidos.' }
  }

  const body = raw as Record<string, unknown>
  const obra_id = typeof body.obra_id === 'string' ? body.obra_id.trim() : ''

  if (!UUID_RE.test(obra_id)) {
    return { ok: false, error: 'Selecciona una obra.' }
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return { ok: false, error: 'Agrega al menos un material a la solicitud.' }
  }
  if (body.items.length > MAX_ITEMS) {
    return {
      ok: false,
      error: `No puedes agregar m?s de ${MAX_ITEMS} materiales en una sola solicitud.`,
    }
  }

  const items: SolicitudItemInput[] = []
  const vistos = new Set<string>()

  for (let i = 0; i < body.items.length; i++) {
    const parsedItem = validateItem(body.items[i], i)
    if (!parsedItem.ok) {
      return parsedItem
    }
    if (vistos.has(parsedItem.data.material_id)) {
      return {
        ok: false,
        error: `Rengl?n ${i + 1}: ese material ya est? en la solicitud, combina la cantidad en un solo rengl?n.`,
      }
    }
    vistos.add(parsedItem.data.material_id)
    items.push(parsedItem.data)
  }

  return {
    ok: true,
    data: {
      obra_id,
      nota: trimOrNull(body.nota),
      items,
    },
  }
}
