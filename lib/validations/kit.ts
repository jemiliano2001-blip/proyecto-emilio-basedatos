export interface MaterialKitItemInput {
  material_id: string
  cantidad: number
}

export interface MaterialKitInput {
  nombre: string
  material_principal_id: string | null
  configuracion: string | null
  descripcion: string | null
  activo: boolean
  items: MaterialKitItemInput[]
}

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function trimOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export function validateMaterialKitInput(raw: unknown): ValidationResult<MaterialKitInput> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Datos de kit inválidos.' }
  }

  const body = raw as Record<string, unknown>
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''

  if (nombre.length < 2) {
    return { ok: false, error: 'El nombre del kit/ensamble debe tener al menos 2 caracteres.' }
  }
  if (nombre.length > 200) {
    return { ok: false, error: 'El nombre del kit es demasiado largo.' }
  }

  const principalRaw = trimOrNull(body.material_principal_id)
  if (principalRaw !== null && !UUID_RE.test(principalRaw)) {
    return { ok: false, error: 'Identificador del material principal inválido.' }
  }

  let itemsRaw: unknown[] = []
  if (typeof body.items_json === 'string' && body.items_json.trim() !== '') {
    try {
      const parsed = JSON.parse(body.items_json)
      if (Array.isArray(parsed)) itemsRaw = parsed
    } catch {
      return { ok: false, error: 'No se pudieron leer los componentes del kit.' }
    }
  } else if (Array.isArray(body.items)) {
    itemsRaw = body.items
  }

  const items: MaterialKitItemInput[] = []
  const vistos = new Set<string>()

  for (let i = 0; i < itemsRaw.length; i++) {
    const row = itemsRaw[i] as Record<string, unknown>
    if (typeof row !== 'object' || row === null) continue
    const material_id = typeof row.material_id === 'string' ? row.material_id.trim() : ''
    if (!material_id || !UUID_RE.test(material_id)) continue
    if (vistos.has(material_id)) continue

    const cantNum = typeof row.cantidad === 'number' ? row.cantidad : parseFloat(String(row.cantidad))
    if (!Number.isFinite(cantNum) || cantNum <= 0) {
      return { ok: false, error: `Cantidad inválida para el componente ${i + 1}.` }
    }

    vistos.add(material_id)
    items.push({
      material_id,
      cantidad: Math.round(cantNum * 100) / 100,
    })
  }

  return {
    ok: true,
    data: {
      nombre,
      material_principal_id: principalRaw,
      configuracion: trimOrNull(body.configuracion),
      descripcion: trimOrNull(body.descripcion),
      activo: body.activo !== false,
      items,
    },
  }
}
