import { parseQuantity, roundQuantity } from '@/lib/money'
import type { MonedaOc } from '@/lib/types'

export interface CotizacionItemInput {
  solicitud_item_id: string
  proveedor_id: string
  precio_unitario: number
  cantidad: number
  moneda: MonedaOc
}

export interface CotizacionInput {
  solicitud_id: string
  nota: string | null
  items: CotizacionItemInput[]
}

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MONEDAS: readonly MonedaOc[] = ['MXN', 'USD']

function trimOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function parseMoney(raw: unknown): number | null {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null
    return roundQuantity(raw)
  }
  if (typeof raw === 'string') {
    return parseQuantity(raw)
  }
  return null
}

function validateItem(raw: unknown, index: number): ValidationResult<CotizacionItemInput> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: `Renglón ${index + 1}: datos inválidos.` }
  }

  const body = raw as Record<string, unknown>
  const solicitud_item_id =
    typeof body.solicitud_item_id === 'string' ? body.solicitud_item_id.trim() : ''
  const proveedor_id = typeof body.proveedor_id === 'string' ? body.proveedor_id.trim() : ''

  if (!UUID_RE.test(solicitud_item_id)) {
    return { ok: false, error: `Renglón ${index + 1}: material de solicitud inválido.` }
  }
  if (!UUID_RE.test(proveedor_id)) {
    return { ok: false, error: `Renglón ${index + 1}: selecciona un proveedor.` }
  }

  const precio = parseMoney(body.precio_unitario)
  if (precio === null || precio < 0) {
    return { ok: false, error: `Renglón ${index + 1}: el precio debe ser un número ≥ 0.` }
  }

  const cantidad = parseMoney(body.cantidad)
  if (cantidad === null || cantidad <= 0) {
    return { ok: false, error: `Renglón ${index + 1}: la cantidad debe ser mayor a cero.` }
  }

  const monedaRaw = typeof body.moneda === 'string' ? body.moneda : 'MXN'
  if (!MONEDAS.includes(monedaRaw as MonedaOc)) {
    return { ok: false, error: `Renglón ${index + 1}: moneda no válida (MXN o USD).` }
  }

  return {
    ok: true,
    data: {
      solicitud_item_id,
      proveedor_id,
      precio_unitario: precio,
      cantidad,
      moneda: monedaRaw as MonedaOc,
    },
  }
}

export function validateCotizacionInput(raw: unknown): ValidationResult<CotizacionInput> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Datos de cotización inválidos.' }
  }

  const body = raw as Record<string, unknown>
  const solicitud_id = typeof body.solicitud_id === 'string' ? body.solicitud_id.trim() : ''

  if (!UUID_RE.test(solicitud_id)) {
    return { ok: false, error: 'Solicitud no válida.' }
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return { ok: false, error: 'Agrega al menos un renglón con precio.' }
  }

  const items: CotizacionItemInput[] = []
  const vistos = new Set<string>()
  let moneda: MonedaOc | null = null

  for (let i = 0; i < body.items.length; i++) {
    const parsedItem = validateItem(body.items[i], i)
    if (!parsedItem.ok) return parsedItem
    if (vistos.has(parsedItem.data.solicitud_item_id)) {
      return {
        ok: false,
        error: `Renglón ${i + 1}: ese material ya está cotizado en esta cotización.`,
      }
    }
    if (moneda === null) {
      moneda = parsedItem.data.moneda
    } else if (parsedItem.data.moneda !== moneda) {
      return {
        ok: false,
        error: 'Todos los renglones de una cotización deben usar la misma moneda.',
      }
    }
    vistos.add(parsedItem.data.solicitud_item_id)
    items.push(parsedItem.data)
  }

  return {
    ok: true,
    data: {
      solicitud_id,
      nota: trimOrNull(body.nota),
      items,
    },
  }
}
