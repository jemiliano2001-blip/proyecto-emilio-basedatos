'use server'

import { revalidatePath } from 'next/cache'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeReportarInstalacion } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { validateInstalacionInput } from '@/lib/validations/instalacion'
import { matchesOfflineOwner } from '@/lib/offline/owner'

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

  const parsed = validateInstalacionInput({ id:formData.get('id'),obra_id:obraId,material_id:materialId,cantidad:formData.get('cantidad'),nota:formData.get('nota') })
  if (!parsed.ok) return { error: parsed.error }

  const supabase = await createClient()
  const { error } = await supabase.rpc('reportar_instalacion_material', {
    p_obra_id: obraId,
    p_material_id: materialId,
    p_cantidad: parsed.data.cantidad,
    p_nota: parsed.data.nota,
    p_id: parsed.data.id,
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

export async function syncInstalacionPayload(raw: unknown) {
  const session = await getSessionUsuario()
  if (!session || !matchesOfflineOwner(raw, session.authUserId) || !puedeReportarInstalacion(session.rol)) {
    return { status: 'no_autenticado' as const }
  }
  const parsed = validateInstalacionInput(raw)
  if (!parsed.ok) return { status: 'conflicto' as const, error: parsed.error }
  const { id, obra_id, material_id, cantidad, nota } = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.rpc('reportar_instalacion_material', {p_id:id,p_obra_id:obra_id,p_material_id:material_id,p_cantidad:cantidad,p_nota:nota})
  if (error) return { status: error.code === 'P0001' ? 'conflicto' as const : 'reintentar' as const, error: error.code === 'P0001' ? error.message : 'No se pudo enviar la instalación. Reintenta.' }
  revalidatePath(`/inventario/${obra_id}`)
  revalidatePath('/inventario')
  return { status:'sincronizado' as const,id }
}
