'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeCapturarRecepcion, puedeRevisarRecepcion } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { validateRecepcionInput } from '@/lib/validations/recepcion'

export type ActionResult = { error: string | null; ok?: boolean; id?: string }

function rpcErrorMessage(error: { message?: string } | null, fallback: string): string {
  const msg = error?.message?.trim()
  if (!msg) return fallback
  // Quitar prefijos técnicos de PostgREST/Postgres cuando sea posible
  const cleaned = msg.replace(/^.*ERROR:\s*/i, '').split('\n')[0]?.trim()
  return cleaned && cleaned.length > 0 ? cleaned : fallback
}

export async function crearRecepcionAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !session.perfil || !puedeCapturarRecepcion(session.rol)) {
    return { error: 'No tienes permiso para registrar recepciones.' }
  }

  let itemsRaw: unknown = []
  const itemsJson = formData.get('items_json')
  if (typeof itemsJson === 'string' && itemsJson.trim() !== '') {
    try {
      itemsRaw = JSON.parse(itemsJson)
    } catch {
      return { error: 'No se pudieron leer los renglones del checklist.' }
    }
  }

  const parsed = validateRecepcionInput({
    id: formData.get('id'),
    orden_id: formData.get('orden_id'),
    referencia_entrega: formData.get('referencia_entrega'),
    nota: formData.get('nota'),
    recibido_en: formData.get('recibido_en'),
    items: itemsRaw,
  })

  if (!parsed.ok) return { error: parsed.error }

  const supabase = createClient()
  const { data, error } = await supabase.rpc('crear_recepcion', {
    p_id: parsed.data.id,
    p_orden_id: parsed.data.orden_id,
    p_referencia_entrega: parsed.data.referencia_entrega,
    p_nota: parsed.data.nota,
    p_recibido_en: parsed.data.recibido_en,
    p_items: parsed.data.items,
  })

  if (error) {
    return { error: rpcErrorMessage(error, 'No se pudo guardar la recepción.') }
  }

  const recepcionId = typeof data === 'string' ? data : parsed.data.id

  revalidatePath('/recepciones')
  revalidatePath(`/recepciones/${recepcionId}`)
  revalidatePath('/ordenes')
  revalidatePath(`/ordenes/${parsed.data.orden_id}`)
  redirect(`/recepciones/${recepcionId}`)
}

export async function syncRecepcionPayload(
  raw: unknown
): Promise<
  | { status: 'sincronizado'; id: string }
  | { status: 'conflicto'; error: string }
  | { status: 'no_autenticado' }
  | { status: 'reintentar'; error: string }
> {
  const session = await getSessionUsuario()
  if (!session || !session.perfil || !puedeCapturarRecepcion(session.rol)) {
    return { status: 'no_autenticado' }
  }

  const parsed = validateRecepcionInput(raw)
  if (!parsed.ok) {
    return { status: 'conflicto', error: parsed.error }
  }

  const supabase = createClient()
  const { data, error } = await supabase.rpc('crear_recepcion', {
    p_id: parsed.data.id,
    p_orden_id: parsed.data.orden_id,
    p_referencia_entrega: parsed.data.referencia_entrega,
    p_nota: parsed.data.nota,
    p_recibido_en: parsed.data.recibido_en,
    p_items: parsed.data.items,
  })

  if (error) {
    const msg = rpcErrorMessage(error, 'No se pudo sincronizar la recepción.')
    const lower = msg.toLowerCase()
    if (
      lower.includes('conflicto') ||
      lower.includes('ya no admite') ||
      lower.includes('no pertenece') ||
      lower.includes('sobre-recepción')
    ) {
      return { status: 'conflicto', error: msg }
    }
    return { status: 'reintentar', error: msg }
  }

  return {
    status: 'sincronizado',
    id: typeof data === 'string' ? data : parsed.data.id,
  }
}

export async function revisarRecepcionAction(
  recepcionId: string,
  aprobar: boolean,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeRevisarRecepcion(session.rol)) {
    return { error: 'No tienes permiso para revisar recepciones.' }
  }

  const notaRaw = formData.get('nota_revision')
  const nota =
    typeof notaRaw === 'string' && notaRaw.trim() !== '' ? notaRaw.trim() : null

  if (!aprobar && !nota) {
    return { error: 'Al rechazar debes indicar una nota.' }
  }

  const supabase = createClient()
  const { data: recepcion } = await supabase
    .from('recepciones_material')
    .select('id, orden_id, estado')
    .eq('id', recepcionId)
    .maybeSingle()

  if (!recepcion) {
    return { error: 'La recepción no existe.' }
  }
  if (recepcion.estado !== 'pendiente_revision') {
    return { error: 'Esta recepción ya fue revisada.' }
  }

  const { error } = await supabase.rpc('revisar_recepcion', {
    p_recepcion_id: recepcionId,
    p_aprobar: aprobar,
    p_nota: nota,
  })

  if (error) {
    return { error: rpcErrorMessage(error, 'No se pudo completar la revisión.') }
  }

  revalidatePath('/recepciones')
  revalidatePath(`/recepciones/${recepcionId}`)
  revalidatePath('/ordenes')
  revalidatePath(`/ordenes/${recepcion.orden_id}`)
  redirect(`/recepciones/${recepcionId}`)
}
