import type { TipoArchivoFactura } from '@/lib/types'

export interface FacturaOrdenInput {
  orden_id: string
  obra_id: string
  folio_factura?: string | null
  monto_factura?: number | null
}

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function validateFacturaOrdenInput(raw: unknown): ValidationResult<FacturaOrdenInput> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Datos de factura inválidos.' }
  }

  const body = raw as Record<string, unknown>
  const orden_id = typeof body.orden_id === 'string' ? body.orden_id.trim() : ''
  const obra_id = typeof body.obra_id === 'string' ? body.obra_id.trim() : ''

  if (!UUID_RE.test(orden_id)) {
    return { ok: false, error: 'Identificador de orden de compra inválido.' }
  }

  if (!UUID_RE.test(obra_id)) {
    return { ok: false, error: 'Identificador de proyecto inválido.' }
  }

  let folio_factura: string | null = null
  if (typeof body.folio_factura === 'string' && body.folio_factura.trim().length > 0) {
    folio_factura = body.folio_factura.trim()
    if (folio_factura.length > 100) {
      return { ok: false, error: 'El folio de la factura es demasiado largo.' }
    }
  }

  let monto_factura: number | null = null
  if (body.monto_factura !== undefined && body.monto_factura !== null && body.monto_factura !== '') {
    const parsedMonto = Number(body.monto_factura)
    if (isNaN(parsedMonto) || parsedMonto < 0) {
      return { ok: false, error: 'El monto de la factura debe ser un número válido mayor o igual a 0.' }
    }
    monto_factura = Math.round(parsedMonto * 100) / 100
  }

  return {
    ok: true,
    data: {
      orden_id,
      obra_id,
      folio_factura,
      monto_factura,
    },
  }
}

export function detectTipoArchivo(fileName: string, mimeType: string): TipoArchivoFactura {
  const lowerName = fileName.toLowerCase()
  if (mimeType === 'application/pdf' || lowerName.endsWith('.pdf')) {
    return 'pdf'
  }
  if (
    mimeType.startsWith('image/') ||
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg') ||
    lowerName.endsWith('.png') ||
    lowerName.endsWith('.webp')
  ) {
    return 'imagen'
  }
  if (mimeType === 'text/xml' || mimeType === 'application/xml' || lowerName.endsWith('.xml')) {
    return 'xml'
  }
  return 'otro'
}
