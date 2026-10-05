export interface InstalacionInput { id: string; obra_id: string; material_id: string; cantidad: number; nota: string | null }

export function validateInstalacionInput(raw: unknown):
  | { ok: true; data: InstalacionInput }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Reporte no válido.' }
  const input = raw as Record<string, unknown>
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (['id','obra_id','material_id'].some(key => typeof input[key] !== 'string' || !uuid.test(input[key] as string))) {
    return { ok: false, error: 'El reporte requiere identificadores válidos.' }
  }
  const cantidad = Math.round(Number(String(input.cantidad ?? '').trim().replace(',', '.')) * 100) / 100
  if (!Number.isFinite(cantidad) || cantidad <= 0 || cantidad > 9999999999.99) return { ok: false, error: 'Escribe una cantidad válida mayor a cero, con hasta dos decimales.' }
  if (input.nota != null && typeof input.nota !== 'string') return { ok: false, error: 'Nota no válida.' }
  const nota = typeof input.nota === 'string' ? input.nota.trim() || null : null
  if (nota && nota.length > 2000) return { ok: false, error: 'La nota admite hasta 2000 caracteres.' }
  return { ok: true, data: {id: input.id as string, obra_id: input.obra_id as string, material_id: input.material_id as string, cantidad, nota} }
}
