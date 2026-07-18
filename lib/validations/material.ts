export interface MaterialInput {
  nombre_base: string
  variante: string | null
  unidad_medida: string
  categoria: string | null
  subcategoria: string | null
  especificacion: string | null
  activo: boolean
}

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

function trimOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export function validateMaterialInput(raw: unknown): ValidationResult<MaterialInput> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Datos de material inválidos.' }
  }

  const body = raw as Record<string, unknown>
  const nombre_base = typeof body.nombre_base === 'string' ? body.nombre_base.trim() : ''
  const unidad_medida =
    typeof body.unidad_medida === 'string' ? body.unidad_medida.trim().toUpperCase() : ''

  if (nombre_base.length < 2) {
    return { ok: false, error: 'El nombre del material debe tener al menos 2 caracteres.' }
  }
  if (nombre_base.length > 200) {
    return { ok: false, error: 'El nombre del material es demasiado largo.' }
  }
  if (unidad_medida.length < 1 || unidad_medida.length > 20) {
    return { ok: false, error: 'Indica una unidad de medida (ej. PZA, MTS, KG).' }
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
      nombre_base,
      variante: trimOrNull(body.variante),
      unidad_medida,
      categoria: trimOrNull(body.categoria),
      subcategoria: trimOrNull(body.subcategoria),
      especificacion: trimOrNull(body.especificacion),
      activo,
    },
  }
}
