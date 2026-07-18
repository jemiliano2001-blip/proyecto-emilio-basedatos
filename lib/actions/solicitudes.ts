'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeCrearSolicitudes } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { validateSolicitudInput } from '@/lib/validations/solicitud'

export type ActionResult = { error: string | null; ok?: boolean }

export async function createSolicitudAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !session.perfil || !puedeCrearSolicitudes(session.rol)) {
    return { error: 'No tienes permiso para levantar solicitudes.' }
  }

  let itemsRaw: unknown = []
  const itemsJson = formData.get('items_json')
  if (typeof itemsJson === 'string' && itemsJson.trim() !== '') {
    try {
      itemsRaw = JSON.parse(itemsJson)
    } catch {
      return { error: 'No se pudieron leer los materiales agregados. Intenta de nuevo.' }
    }
  }

  const parsed = validateSolicitudInput({
    obra_id: formData.get('obra_id'),
    nota: formData.get('nota'),
    items: itemsRaw,
  })

  if (!parsed.ok) {
    return { error: parsed.error }
  }

  const supabase = createClient()
  const solicitanteId = session.perfil.id

  const { data: obra } = await supabase
    .from('obras')
    .select('id, estado')
    .eq('id', parsed.data.obra_id)
    .maybeSingle()

  if (!obra) {
    return { error: 'La obra seleccionada no existe.' }
  }
  if (obra.estado !== 'activa') {
    return { error: 'Solo puedes solicitar material para obras activas.' }
  }

  const materialIds = parsed.data.items.map((item) => item.material_id)
  const { data: materiales } = await supabase
    .from('catalogo_materiales')
    .select('id, activo')
    .in('id', materialIds)

  if (!materiales || materiales.length !== materialIds.length) {
    return { error: 'Uno o más materiales de la solicitud no existen.' }
  }
  if (materiales.some((m) => !m.activo)) {
    return { error: 'Uno o más materiales están inactivos. Quítalos de la solicitud.' }
  }

  const { data: solicitud, error: errorSolicitud } = await supabase
    .from('solicitudes_material')
    .insert({
      obra_id: parsed.data.obra_id,
      solicitante_id: solicitanteId,
      nota: parsed.data.nota,
    })
    .select('id')
    .single()

  if (errorSolicitud || !solicitud) {
    return { error: 'No se pudo crear la solicitud. Intenta de nuevo.' }
  }

  const { error: errorItems } = await supabase.from('solicitud_items').insert(
    parsed.data.items.map((item) => ({
      solicitud_id: solicitud.id,
      material_id: item.material_id,
      cantidad_solicitada: item.cantidad_solicitada,
      nota: item.nota,
    }))
  )

  if (errorItems) {
    // No dejar solicitudes huérfanas sin materiales (policy DELETE en 0003).
    await supabase.from('solicitudes_material').delete().eq('id', solicitud.id)
    return { error: 'No se pudieron guardar los materiales de la solicitud. Intenta de nuevo.' }
  }

  // Aviso a Compras — mejor esfuerzo, no debe tumbar la solicitud si falla.
  await supabase.from('notificaciones').insert({
    rol_destino: 'compras',
    titulo: 'Nueva solicitud de material',
    mensaje: `${session.perfil.nombre} levantó una solicitud con ${parsed.data.items.length} material(es).`,
    tipo: 'solicitud_nueva',
    referencia_id: solicitud.id,
  })

  revalidatePath('/solicitudes')
  redirect(`/solicitudes/${solicitud.id}`)
}

export async function syncSolicitudPayload(
  raw: unknown
): Promise<
  | { status: 'sincronizado'; id: string }
  | { status: 'conflicto'; error: string }
  | { status: 'no_autenticado' }
  | { status: 'reintentar'; error: string }
> {
  const session = await getSessionUsuario()
  if (!session || !session.perfil || !puedeCrearSolicitudes(session.rol)) {
    return { status: 'no_autenticado' }
  }

  if (typeof raw !== 'object' || raw === null) {
    return { status: 'conflicto', error: 'Datos de solicitud inválidos.' }
  }

  const body = raw as Record<string, unknown>
  const clientId = typeof body.id === 'string' ? body.id.trim() : ''
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  if (!UUID_RE.test(clientId)) {
    return { status: 'conflicto', error: 'Identificador de solicitud inválido.' }
  }

  const parsed = validateSolicitudInput({
    obra_id: body.obra_id,
    nota: body.nota,
    items: body.items,
  })
  if (!parsed.ok) {
    return { status: 'conflicto', error: parsed.error }
  }

  const supabase = createClient()

  const { data: existente } = await supabase
    .from('solicitudes_material')
    .select('id, solicitante_id')
    .eq('id', clientId)
    .maybeSingle()

  if (existente) {
    if (existente.solicitante_id !== session.perfil.id) {
      return {
        status: 'conflicto',
        error: 'Esa solicitud ya existe con otro solicitante.',
      }
    }
    return { status: 'sincronizado', id: existente.id }
  }

  const { data: obra } = await supabase
    .from('obras')
    .select('id, estado')
    .eq('id', parsed.data.obra_id)
    .maybeSingle()

  if (!obra) {
    return { status: 'conflicto', error: 'La obra seleccionada no existe.' }
  }
  if (obra.estado !== 'activa') {
    return { status: 'conflicto', error: 'Solo puedes solicitar material para obras activas.' }
  }

  const materialIds = parsed.data.items.map((item) => item.material_id)
  const { data: materiales } = await supabase
    .from('catalogo_materiales')
    .select('id, activo')
    .in('id', materialIds)

  if (!materiales || materiales.length !== materialIds.length) {
    return { status: 'conflicto', error: 'Uno o más materiales no existen.' }
  }
  if (materiales.some((m) => !m.activo)) {
    return { status: 'conflicto', error: 'Uno o más materiales están inactivos.' }
  }

  const { data: solicitud, error: errorSolicitud } = await supabase
    .from('solicitudes_material')
    .insert({
      id: clientId,
      obra_id: parsed.data.obra_id,
      solicitante_id: session.perfil.id,
      nota: parsed.data.nota,
    })
    .select('id')
    .single()

  if (errorSolicitud || !solicitud) {
    return {
      status: 'reintentar',
      error: 'No se pudo crear la solicitud. Intenta de nuevo.',
    }
  }

  const { error: errorItems } = await supabase.from('solicitud_items').insert(
    parsed.data.items.map((item) => ({
      solicitud_id: solicitud.id,
      material_id: item.material_id,
      cantidad_solicitada: item.cantidad_solicitada,
      nota: item.nota,
    }))
  )

  if (errorItems) {
    await supabase.from('solicitudes_material').delete().eq('id', solicitud.id)
    return {
      status: 'reintentar',
      error: 'No se pudieron guardar los materiales.',
    }
  }

  await supabase.from('notificaciones').insert({
    rol_destino: 'compras',
    titulo: 'Nueva solicitud de material',
    mensaje: `${session.perfil.nombre} levantó una solicitud con ${parsed.data.items.length} material(es).`,
    tipo: 'solicitud_nueva',
    referencia_id: solicitud.id,
  })

  revalidatePath('/solicitudes')
  return { status: 'sincronizado', id: solicitud.id }
}

export async function cancelSolicitudAction(
  solicitudId: string,
  _prev: ActionResult,
  _formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !session.perfil) {
    return { error: 'No autenticado.' }
  }

  const supabase = createClient()
  const { data: solicitud } = await supabase
    .from('solicitudes_material')
    .select('id, solicitante_id, estado')
    .eq('id', solicitudId)
    .maybeSingle()

  if (!solicitud) {
    return { error: 'La solicitud ya no existe.' }
  }

  const esDueno = solicitud.solicitante_id === session.perfil.id
  const puedeCancelar =
    session.rol === 'acceso_total' || (esDueno && solicitud.estado === 'pendiente')

  if (!puedeCancelar) {
    return { error: 'No puedes cancelar esta solicitud.' }
  }

  const { error } = await supabase
    .from('solicitudes_material')
    .update({ estado: 'cancelada', cancelado_en: new Date().toISOString() })
    .eq('id', solicitudId)

  if (error) {
    return { error: 'No se pudo cancelar la solicitud. Intenta de nuevo.' }
  }

  revalidatePath('/solicitudes')
  revalidatePath(`/solicitudes/${solicitudId}`)
  return { error: null, ok: true }
}
