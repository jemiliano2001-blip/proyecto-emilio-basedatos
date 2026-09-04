import { parseQuantity } from '@/lib/money'

export type EstadoObra = 'activa' | 'pausada' | 'cerrada'

export interface TopeCreacionInput {
  material_id: string
  cantidad_contratada: number
}

export interface ObraInput {
  nombre: string
  cliente: string | null
  ciudad: string | null
  fraccionamiento: string | null
  paquete: string | null
  ubicacion: string | null
  estado: EstadoObra
  presupuesto_mxn: number
  topes: TopeCreacionInput[]
}

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

const ESTADOS: readonly EstadoObra[] = ['activa', 'pausada', 'cerrada']

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function trimOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function parsePresupuesto(raw: unknown): number | null {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw < 0) return null
    return Math.round(raw * 100) / 100
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (trimmed === '') return 0
    return parseQuantity(trimmed)
  }
  return 0
}

export function validateObraInput(raw: unknown): ValidationResult<ObraInput> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Datos de proyecto inválidos.' }
  }

  const body = raw as Record<string, unknown>
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''

  if (nombre.length < 2) {
    return { ok: false, error: 'El nombre del proyecto debe tener al menos 2 caracteres.' }
  }
  if (nombre.length > 200) {
    return { ok: false, error: 'El nombre del proyecto es demasiado largo.' }
  }

  const estadoRaw = typeof body.estado === 'string' ? body.estado : 'activa'
  if (!ESTADOS.includes(estadoRaw as EstadoObra)) {
    return { ok: false, error: 'Estatus de proyecto no válido.' }
  }

  const presupuesto = parsePresupuesto(body.presupuesto_mxn)
  if (presupuesto === null || presupuesto < 0) {
    return { ok: false, error: 'El presupuesto MXN debe ser un número válido (≥ 0).' }
  }
  if (presupuesto > 999999999999.99) {
    return { ok: false, error: 'El presupuesto MXN es demasiado grande.' }
  }

  let topesRaw: unknown[] = []
  if (typeof body.topes_json === 'string' && body.topes_json.trim() !== '') {
    try {
      const parsed = JSON.parse(body.topes_json) as unknown
      if (!Array.isArray(parsed)) {
        return { ok: false, error: 'Presupuesto de materiales inválido.' }
      }
      topesRaw = parsed
    } catch {
      return { ok: false, error: 'No se pudo leer el presupuesto de materiales.' }
    }
  } else if (Array.isArray(body.topes)) {
    topesRaw = body.topes
  }

  const topes: TopeCreacionInput[] = []
  const vistos = new Set<string>()

  for (let i = 0; i < topesRaw.length; i++) {
    const row = topesRaw[i]
    if (typeof row !== 'object' || row === null) {
      return { ok: false, error: `Tope ${i + 1}: datos inválidos.` }
    }
    const t = row as Record<string, unknown>
    const material_id = typeof t.material_id === 'string' ? t.material_id.trim() : ''
    if (!material_id) continue
    if (!UUID_RE.test(material_id)) {
      return { ok: false, error: `Tope ${i + 1}: selecciona un material del catálogo.` }
    }
    if (vistos.has(material_id)) {
      return { ok: false, error: `Tope ${i + 1}: material duplicado.` }
    }
    const cantidadRaw =
      typeof t.cantidad_contratada === 'number'
        ? String(t.cantidad_contratada)
        : typeof t.cantidad_contratada === 'string'
          ? t.cantidad_contratada
          : ''
    const cantidad = parseQuantity(cantidadRaw)
    if (cantidad === null || cantidad < 0) {
      return { ok: false, error: `Tope ${i + 1}: cantidad inválida.` }
    }
    if (cantidad === 0) continue
    vistos.add(material_id)
    topes.push({ material_id, cantidad_contratada: cantidad })
  }

  return {
    ok: true,
    data: {
      nombre,
      cliente: trimOrNull(body.cliente),
      ciudad: trimOrNull(body.ciudad),
      fraccionamiento: trimOrNull(body.fraccionamiento),
      paquete: trimOrNull(body.paquete),
      ubicacion: trimOrNull(body.ubicacion),
      estado: estadoRaw as EstadoObra,
      presupuesto_mxn: presupuesto,
      topes,
    },
  }
}
