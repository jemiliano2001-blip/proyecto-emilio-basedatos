import { parseQuantity, roundQuantity } from '@/lib/money'
import type { EstadoRecepcionItem } from '@/lib/types'

export interface RecepcionFotoInput {
  id?: string
  orden_item_id?: string | null
  tipo_foto?: string
  foto_url: string
  latitud?: number | null
  longitud?: number | null
  precision_gps_m?: number | null
  resolucion_px?: string | null
  tamano_bytes?: number | null
  calidad_score?: number | null
  notas?: string | null
}

export interface RecepcionItemInput {
  orden_item_id: string
  cantidad_recibida: number
  cantidad_danada: number
  estado: EstadoRecepcionItem
  observacion: string | null
  foto_url?: string | null
}

export interface RecepcionInput {
  id: string
  orden_id: string
  referencia_entrega: string | null
  nota: string | null
  foto_remision_url?: string | null
  foto_evidencia_url?: string | null
  recibido_en: string
  items: RecepcionItemInput[]
  fotos?: RecepcionFotoInput[]
}

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const ESTADOS_ITEM: readonly EstadoRecepcionItem[] = [
  'completo',
  'parcial',
  'faltante',
  'danado',
]

const MAX_ITEMS = 100

function trimOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function parseQty(raw: unknown): number | null {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null
    return roundQuantity(raw)
  }
  if (typeof raw === 'string') {
    return parseQuantity(raw)
  }
  return null
}

function isIsoUtc(value: string): boolean {
  const ms = Date.parse(value)
  return Number.isFinite(ms)
}

function validateItem(raw: unknown, index: number): ValidationResult<RecepcionItemInput> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: `Material ${index + 1}: datos inválidos.` }
  }

  const body = raw as Record<string, unknown>
  const orden_item_id = typeof body.orden_item_id === 'string' ? body.orden_item_id.trim() : ''
  if (!UUID_RE.test(orden_item_id)) {
    return { ok: false, error: `Material ${index + 1}: material de la orden inválido.` }
  }

  const cantidad_recibida = parseQty(body.cantidad_recibida)
  const cantidad_danada = parseQty(body.cantidad_danada ?? 0)
  if (cantidad_recibida === null || cantidad_recibida < 0) {
    return { ok: false, error: `Material ${index + 1}: cantidad buena inválida.` }
  }
  if (cantidad_danada === null || cantidad_danada < 0) {
    return { ok: false, error: `Material ${index + 1}: cantidad dañada inválida.` }
  }

  const estadoRaw = typeof body.estado === 'string' ? body.estado : ''
  if (!ESTADOS_ITEM.includes(estadoRaw as EstadoRecepcionItem)) {
    return { ok: false, error: `Material ${index + 1}: estado no válido.` }
  }
  const estado = estadoRaw as EstadoRecepcionItem
  const observacion = trimOrNull(body.observacion)

  if (
    (estado === 'faltante' || estado === 'danado' || cantidad_danada > 0) &&
    !observacion
  ) {
    return {
      ok: false,
      error: `Material ${index + 1}: indica una observación para faltante o daño.`,
    }
  }

  if (cantidad_recibida === 0 && cantidad_danada === 0 && estado !== 'faltante') {
    return {
      ok: false,
      error: `Material ${index + 1}: captura cantidad o márcalo como faltante.`,
    }
  }

  const foto_url = trimOrNull(body.foto_url)

  return {
    ok: true,
    data: {
      orden_item_id,
      cantidad_recibida,
      cantidad_danada,
      estado,
      observacion,
      foto_url,
    },
  }
}

export function validateRecepcionInput(raw: unknown): ValidationResult<RecepcionInput> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Datos de recepción inválidos.' }
  }

  const body = raw as Record<string, unknown>
  const id = typeof body.id === 'string' ? body.id.trim() : ''
  const orden_id = typeof body.orden_id === 'string' ? body.orden_id.trim() : ''

  if (!UUID_RE.test(id)) {
    return { ok: false, error: 'Identificador de recepción inválido.' }
  }
  if (!UUID_RE.test(orden_id)) {
    return { ok: false, error: 'Orden de compra no válida.' }
  }

  const recibido_en =
    typeof body.recibido_en === 'string' && body.recibido_en.trim() !== ''
      ? body.recibido_en.trim()
      : new Date().toISOString()

  if (!isIsoUtc(recibido_en)) {
    return { ok: false, error: 'Fecha de recepción inválida.' }
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return { ok: false, error: 'Agrega al menos un material al checklist.' }
  }
  if (body.items.length > MAX_ITEMS) {
    return { ok: false, error: 'Demasiados materiales en una recepción.' }
  }

  const items: RecepcionItemInput[] = []
  const vistos = new Set<string>()

  for (let i = 0; i < body.items.length; i++) {
    const parsedItem = validateItem(body.items[i], i)
    if (!parsedItem.ok) return parsedItem
    if (vistos.has(parsedItem.data.orden_item_id)) {
      return {
        ok: false,
        error: `Material ${i + 1}: ese material ya está en este checklist.`,
      }
    }
    vistos.add(parsedItem.data.orden_item_id)
    items.push(parsedItem.data)
  }

  let fotos: RecepcionFotoInput[] | undefined = undefined
  if (Array.isArray(body.fotos)) {
    fotos = []
    for (const rawFoto of body.fotos) {
      if (typeof rawFoto === 'object' && rawFoto !== null) {
        const f = rawFoto as Record<string, unknown>
        const foto_url = trimOrNull(f.foto_url)
        if (foto_url) {
          fotos.push({
            id: typeof f.id === 'string' ? f.id : undefined,
            orden_item_id: trimOrNull(f.orden_item_id),
            tipo_foto: typeof f.tipo_foto === 'string' ? f.tipo_foto : undefined,
            foto_url,
            latitud: typeof f.latitud === 'number' ? f.latitud : null,
            longitud: typeof f.longitud === 'number' ? f.longitud : null,
            precision_gps_m: typeof f.precision_gps_m === 'number' ? f.precision_gps_m : null,
            resolucion_px: trimOrNull(f.resolucion_px),
            tamano_bytes: typeof f.tamano_bytes === 'number' ? f.tamano_bytes : null,
            calidad_score: typeof f.calidad_score === 'number' ? f.calidad_score : null,
            notas: trimOrNull(f.notas),
          })
        }
      }
    }
  }

  return {
    ok: true,
    data: {
      id,
      orden_id,
      referencia_entrega: trimOrNull(body.referencia_entrega),
      nota: trimOrNull(body.nota),
      foto_remision_url: trimOrNull(body.foto_remision_url),
      foto_evidencia_url: trimOrNull(body.foto_evidencia_url),
      recibido_en: new Date(recibido_en).toISOString(),
      items,
      ...(fotos ? { fotos } : {}),
    },
  }
}
