'use server'

import { revalidatePath } from 'next/cache'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeReportarInstalacion } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'

export type InventarioActionResult = { error: string | null; ok?: boolean }

export async function reportarInstalacionAction(
  obraId: string,
  materialId: string,
  _prev: InventarioActionResult,
  formData: FormData
): Promise<InventarioActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeReportarInstalacion(session.rol)) {
    return { error: 'No tienes permiso para reportar instalaciones.' }
  }

  const rawCant = String(formData.get('cantidad') ?? '')
    .trim()
    .replace(',', '.')
  const cantidad = Number(rawCant)
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return { error: 'Escribe una cantidad válida mayor a cero.' }
  }

  const notaRaw = formData.get('nota')
  const nota =
    typeof notaRaw === 'string' && notaRaw.trim() !== '' ? notaRaw.trim() : null

  const supabase = await createClient()
  const { error } = await supabase.rpc('reportar_instalacion_material', {
    p_obra_id: obraId,
    p_material_id: materialId,
    p_cantidad: Math.round(cantidad * 100) / 100,
    p_nota: nota,
  })

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('pendiente de instalar')) {
      return { error: msg }
    }
    if (msg.includes('No hay material recibido')) {
      return { error: 'No hay material recibido en sitio para este material.' }
    }
    return { error: msg.length > 0 && msg.length < 180 ? msg : 'No se pudo registrar la instalación.' }
  }

  revalidatePath(`/inventario/${obraId}`)
  revalidatePath('/inventario')
  return { error: null, ok: true }
}
