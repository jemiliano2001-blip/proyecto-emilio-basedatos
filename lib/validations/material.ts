import {
  CATEGORIAS_MATERIAL,
  esParCategoriaValido,
  type CategoriaMaterial,
} from '@/lib/catalogo-categorias'
import { parseMoney } from '@/lib/money'

export interface MaterialInput {
  nombre_base: string
  variante: string | null
  unidad_medida: string
  categoria: CategoriaMaterial | null
  subcategoria: string | null
  especificacion: string | null
  precio_base: number
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

  const categoriaRaw = trimOrNull(body.categoria)
  const subcategoria = trimOrNull(body.subcategoria)

  let categoria: CategoriaMaterial | null = null
  if (categoriaRaw !== null) {
    if (!(CATEGORIAS_MATERIAL as readonly string[]).includes(categoriaRaw)) {
      return { ok: false, error: 'Categoría no válida.' }
    }
    categoria = categoriaRaw as CategoriaMaterial
  }

  if (!esParCategoriaValido(categoria, subcategoria)) {
    return {
      ok: false,
      error: 'Elige una subcategoría válida para la categoría seleccionada.',
    }
  }

  let precio_base = 0
  if (body.precio_base !== undefined && body.precio_base !== null) {
    const pNum =
      typeof body.precio_base === 'number'
        ? (Number.isFinite(body.precio_base) ? Math.round(body.precio_base * 100) / 100 : null)
        : parseMoney(String(body.precio_base))
    if (pNum === null || pNum < 0) {
      return { ok: false, error: 'El precio base debe ser un número mayor o igual a 0.' }
    }
    precio_base = pNum
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
      categoria,
      subcategoria,
      especificacion: trimOrNull(body.especificacion),
      precio_base,
      activo,
    },
  }
}
