export type EstadoObra = 'activa' | 'pausada' | 'cerrada'

export interface ObraInput {
  nombre: string
  fraccionamiento: string | null
  paquete: string | null
  ubicacion: string | null
  estado: EstadoObra
}

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

const ESTADOS: readonly EstadoObra[] = ['activa', 'pausada', 'cerrada']

function trimOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export function validateObraInput(raw: unknown): ValidationResult<ObraInput> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Datos de obra inválidos.' }
  }

  const body = raw as Record<string, unknown>
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''

  if (nombre.length < 2) {
    return { ok: false, error: 'El nombre de la obra debe tener al menos 2 caracteres.' }
  }
  if (nombre.length > 200) {
    return { ok: false, error: 'El nombre de la obra es demasiado largo.' }
  }

  const estadoRaw = typeof body.estado === 'string' ? body.estado : 'activa'
  if (!ESTADOS.includes(estadoRaw as EstadoObra)) {
    return { ok: false, error: 'Estado de obra no válido.' }
  }

  return {
    ok: true,
    data: {
      nombre,
      fraccionamiento: trimOrNull(body.fraccionamiento),
      paquete: trimOrNull(body.paquete),
      ubicacion: trimOrNull(body.ubicacion),
      estado: estadoRaw as EstadoObra,
    },
  }
}
