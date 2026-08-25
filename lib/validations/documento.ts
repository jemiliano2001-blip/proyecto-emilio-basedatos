import type { TipoDocumentoObra } from '@/lib/types'

export const TIPOS_DOCUMENTO_OBRA: readonly TipoDocumentoObra[] = [
  'presupuesto',
  'conciliacion',
  'plano',
  'minuta',
  'general',
  'otro',
]

export function labelTipoDocumento(tipo: TipoDocumentoObra): string {
  switch (tipo) {
    case 'presupuesto':
      return 'Presupuesto formal'
    case 'conciliacion':
      return 'Conciliación de precios'
    case 'plano':
      return 'Plano / Diagrama'
    case 'minuta':
      return 'Minuta / Acuerdo'
    case 'general':
      return 'Documento general'
    case 'otro':
      return 'Otro'
  }
}

export interface ObraDocumentoInput {
  obra_id: string
  nombre: string
  tipo_documento: TipoDocumentoObra
}

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function validateObraDocumentoInput(raw: unknown): ValidationResult<ObraDocumentoInput> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Datos de documento inválidos.' }
  }

  const body = raw as Record<string, unknown>
  const obra_id = typeof body.obra_id === 'string' ? body.obra_id.trim() : ''
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''

  if (!UUID_RE.test(obra_id)) {
    return { ok: false, error: 'Identificador de proyecto inválido.' }
  }

  if (nombre.length < 2) {
    return { ok: false, error: 'El nombre del documento debe tener al menos 2 caracteres.' }
  }
  if (nombre.length > 255) {
    return { ok: false, error: 'El nombre del documento es demasiado largo.' }
  }

  const tipo = typeof body.tipo_documento === 'string' ? body.tipo_documento : 'general'
  if (!TIPOS_DOCUMENTO_OBRA.includes(tipo as TipoDocumentoObra)) {
    return { ok: false, error: 'Tipo de documento no válido.' }
  }

  return {
    ok: true,
    data: {
      obra_id,
      nombre,
      tipo_documento: tipo as TipoDocumentoObra,
    },
  }
}
