import { parseMoney, parseQuantity } from '@/lib/money'
import type { TipoLineaSolicitud } from '@/lib/types'

export const TIPOS_LINEA_SOLICITUD: readonly TipoLineaSolicitud[] = [
  'material',
  'flete',
  'camiones',
  'mantenimiento',
  'otro',
] as const

export interface SolicitudItemInput {
  tipo_linea: TipoLineaSolicitud
  material_id: string | null
  cantidad_solicitada: number | null
  descripcion: string | null
  monto_mxn: number | null
  nota: string | null
  obra_id: string | null
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
    return { ok: false, error: `Renglón ${index + 1}: datos inválidos.` }
  }

  const body = raw as Record<string, unknown>
  const tipoRaw = typeof body.tipo_linea === 'string' ? body.tipo_linea : 'material'
  if (!(TIPOS_LINEA_SOLICITUD as readonly string[]).includes(tipoRaw)) {
    return { ok: false, error: `Renglón ${index + 1}: tipo de línea no válido.` }
  }
  const tipo_linea = tipoRaw as TipoLineaSolicitud
  const nota = trimOrNull(body.nota)
  const obraIdRaw = typeof body.obra_id === 'string' ? body.obra_id.trim() : ''
  const obra_id = obraIdRaw === '' ? null : obraIdRaw
  if (obra_id !== null && !UUID_RE.test(obra_id)) {
    return { ok: false, error: `Renglón ${index + 1}: obra inválida.` }
  }

  if (tipo_linea === 'material') {
    const material_id = typeof body.material_id === 'string' ? body.material_id.trim() : ''
    if (!UUID_RE.test(material_id)) {
      return { ok: false, error: `Renglón ${index + 1}: selecciona un material.` }
    }

    const cantidadRaw =
      typeof body.cantidad_solicitada === 'number'
        ? String(body.cantidad_solicitada)
        : typeof body.cantidad_solicitada === 'string'
          ? body.cantidad_solicitada
          : ''

    const cantidad = parseQuantity(cantidadRaw)
    if (cantidad === null) {
      return { ok: false, error: `Renglón ${index + 1}: la cantidad debe ser un número válido.` }
    }
    if (cantidad <= 0) {
      return { ok: false, error: `Renglón ${index + 1}: la cantidad debe ser mayor a cero.` }
    }
    if (cantidad > 9999999999.99) {
      return { ok: false, error: `Renglón ${index + 1}: la cantidad es demasiado grande.` }
    }

    let monto_mxn: number | null = null
    const montoRaw =
      typeof body.monto_mxn === 'number'
        ? String(body.monto_mxn)
        : typeof body.monto_mxn === 'string'
          ? body.monto_mxn
          : ''
    if (montoRaw.trim() !== '') {
      const monto = parseMoney(montoRaw)
      if (monto === null || monto < 0) {
        return { ok: false, error: `Renglón ${index + 1}: monto MXN inválido.` }
      }
      monto_mxn = monto
    }

    return {
      ok: true,
      data: {
        tipo_linea: 'material',
        material_id,
        cantidad_solicitada: cantidad,
        descripcion: null,
        monto_mxn,
        nota,
        obra_id,
      },
    }
  }

  const descripcion = trimOrNull(body.descripcion)
  if (!descripcion) {
    return { ok: false, error: `Renglón ${index + 1}: indica una descripción.` }
  }

  const montoRaw =
    typeof body.monto_mxn === 'number'
      ? String(body.monto_mxn)
      : typeof body.monto_mxn === 'string'
        ? body.monto_mxn
        : ''
  const monto = parseMoney(montoRaw)
  if (monto === null || monto <= 0) {
    return { ok: false, error: `Renglón ${index + 1}: el monto MXN debe ser mayor a cero.` }
  }

  return {
    ok: true,
    data: {
      tipo_linea,
      material_id: null,
      cantidad_solicitada: null,
      descripcion,
      monto_mxn: monto,
      nota,
      obra_id,
    },
  }
}

export function validateSolicitudInput(raw: unknown): ValidationResult<SolicitudInput> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Datos de solicitud inválidos.' }
  }

  const body = raw as Record<string, unknown>
  const obra_id = typeof body.obra_id === 'string' ? body.obra_id.trim() : ''

  if (!UUID_RE.test(obra_id)) {
    return { ok: false, error: 'Selecciona un proyecto.' }
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return { ok: false, error: 'Agrega al menos un renglón a la requisición.' }
  }
  if (body.items.length > MAX_ITEMS) {
    return {
      ok: false,
      error: `No puedes agregar más de ${MAX_ITEMS} renglones en una sola requisición.`,
    }
  }

  const items: SolicitudItemInput[] = []
  const vistos = new Set<string>()

  for (let i = 0; i < body.items.length; i++) {
    const parsedItem = validateItem(body.items[i], i)
    if (!parsedItem.ok) {
      return parsedItem
    }
    if (parsedItem.data.tipo_linea === 'material' && parsedItem.data.material_id) {
      const obraEfectiva = parsedItem.data.obra_id ?? obra_id
      const clave = `${parsedItem.data.material_id}::${obraEfectiva}`
      if (vistos.has(clave)) {
        return {
          ok: false,
          error: `Renglón ${i + 1}: ese material ya está en esa obra dentro de la requisición, combina la cantidad en un solo renglón.`,
        }
      }
      vistos.add(clave)
    }
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

export function labelTipoLinea(tipo: TipoLineaSolicitud): string {
  switch (tipo) {
    case 'material':
      return 'Material'
    case 'flete':
      return 'Flete'
    case 'camiones':
      return 'Camiones'
    case 'mantenimiento':
      return 'Mantenimiento'
    case 'otro':
      return 'Otro'
  }
}
