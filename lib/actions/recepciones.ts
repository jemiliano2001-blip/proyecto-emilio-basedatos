'use server'

import { matchesOfflineOwner } from '@/lib/offline/owner'
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

async function uploadRecepcionFoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  file: File | null,
  prefijo: string
): Promise<{ url?: string; storagePath?: string; error?: string }> {
  if (!file || file.size === 0) return {}
  if (!file.type.startsWith('image/')) {
    return { error: 'El archivo adjunto debe ser una imagen válida (JPG, PNG, WebP).' }
  }
  if (file.size > 10 * 1024 * 1024) {
    return { error: 'La fotografía excede el límite de 10 MB.' }
  }
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 40)
  const storagePath = `recepciones/${prefijo}-${crypto.randomUUID()}-${sanitizedName}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await supabase.storage
    .from('materiales')
    .upload(storagePath, buffer, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    })
  if (uploadError) {
    return { error: `Error al subir la fotografía: ${uploadError.message}` }
  }
  const { data: publicData } = supabase.storage
    .from('materiales')
    .getPublicUrl(storagePath)
  return { url: publicData.publicUrl, storagePath }
}

function parseNumOrNull(val: FormDataEntryValue | null): number | null {
  if (!val || typeof val !== 'string') return null
  const num = parseFloat(val)
  return Number.isFinite(num) ? num : null
}

export async function crearRecepcionAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !session.perfil || !puedeCapturarRecepcion(session.rol)) {
    return { error: 'No tienes permiso para registrar recepciones.' }
  }

  const supabase = await createClient()

  // Procesar fotos de remisión y evidencia de entrega
  const fotoRemisionFile = formData.get('foto_remision') as File | null
  const fotoEvidenciaFile = formData.get('foto_evidencia') as File | null

  let foto_remision_url: string | null = (formData.get('foto_remision_existente') as string | null) || null
  let foto_evidencia_url: string | null = (formData.get('foto_evidencia_existente') as string | null) || null
  let remisionStoragePath: string | null = null
  let evidenciaStoragePath: string | null = null

  if (fotoRemisionFile && fotoRemisionFile.size > 0) {
    const upRemision = await uploadRecepcionFoto(supabase, fotoRemisionFile, 'remision')
    if (upRemision.error) return { error: upRemision.error }
    if (upRemision.url) {
      foto_remision_url = upRemision.url
      remisionStoragePath = upRemision.storagePath ?? null
    }
  }

  if (fotoEvidenciaFile && fotoEvidenciaFile.size > 0) {
    const upEvidencia = await uploadRecepcionFoto(supabase, fotoEvidenciaFile, 'evidencia')
    if (upEvidencia.error) return { error: upEvidencia.error }
    if (upEvidencia.url) {
      foto_evidencia_url = upEvidencia.url
      evidenciaStoragePath = upEvidencia.storagePath ?? null
    }
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
    foto_remision_url,
    foto_evidencia_url,
    recibido_en: formData.get('recibido_en'),
    items: itemsRaw,
  })

  if (!parsed.ok) return { error: parsed.error }

  // Subir fotos individuales de renglones si se adjuntaron
  const itemFotosSubidas: {
    orden_item_id: string
    foto_url: string
    storage_path: string
    latitud: number | null
    longitud: number | null
    precision_gps_m: number | null
    calidad_score: number | null
    resolucion_px: string | null
    estado: string
  }[] = []

  for (const item of parsed.data.items) {
    const itemFile = formData.get(`foto_item_${item.orden_item_id}`) as File | null
    if (itemFile && itemFile.size > 0) {
      const upItem = await uploadRecepcionFoto(supabase, itemFile, `item-${item.orden_item_id.slice(0, 8)}`)
      if (upItem.error) return { error: upItem.error }
      if (upItem.url && upItem.storagePath) {
        item.foto_url = upItem.url
        itemFotosSubidas.push({
          orden_item_id: item.orden_item_id,
          foto_url: upItem.url,
          storage_path: upItem.storagePath,
          latitud: parseNumOrNull(formData.get(`foto_item_${item.orden_item_id}_latitud`)),
          longitud: parseNumOrNull(formData.get(`foto_item_${item.orden_item_id}_longitud`)),
          precision_gps_m: parseNumOrNull(formData.get(`foto_item_${item.orden_item_id}_precision_m`)),
          calidad_score: parseNumOrNull(formData.get(`foto_item_${item.orden_item_id}_calidad_score`)),
          resolucion_px: (formData.get(`foto_item_${item.orden_item_id}_resolucion`) as string | null) || null,
          estado: item.estado,
        })
      }
    }
  }

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

  // Actualizar fotos defensivamente en recepciones_material
  if (foto_remision_url || foto_evidencia_url) {
    try {
      await supabase
        .from('recepciones_material')
        .update({
          ...(foto_remision_url ? { foto_remision_url } : {}),
          ...(foto_evidencia_url ? { foto_evidencia_url } : {}),
        })
        .eq('id', recepcionId)
    } catch (err) {
      console.warn('Advertencia: No se pudieron asignar fotos a la recepción en base de datos:', err)
    }
  }

  // Registrar fotos en la tabla recepcion_fotos (con metadatos GPS y calidad)
  try {
    const fotosAInsertar = []

    if (foto_remision_url && remisionStoragePath) {
      fotosAInsertar.push({
        recepcion_id: recepcionId,
        tipo_foto: 'remision_documento',
        storage_path: remisionStoragePath,
        foto_url: foto_remision_url,
        capturado_por: session.authUserId,
        latitud: parseNumOrNull(formData.get('foto_remision_latitud')),
        longitud: parseNumOrNull(formData.get('foto_remision_longitud')),
        precision_gps_m: parseNumOrNull(formData.get('foto_remision_precision_m')),
        calidad_score: parseNumOrNull(formData.get('foto_remision_calidad_score')),
        resolucion_px: (formData.get('foto_remision_resolucion') as string | null) || null,
      })
    }

    if (foto_evidencia_url && evidenciaStoragePath) {
      fotosAInsertar.push({
        recepcion_id: recepcionId,
        tipo_foto: 'material_completo',
        storage_path: evidenciaStoragePath,
        foto_url: foto_evidencia_url,
        capturado_por: session.authUserId,
        latitud: parseNumOrNull(formData.get('foto_evidencia_latitud')),
        longitud: parseNumOrNull(formData.get('foto_evidencia_longitud')),
        precision_gps_m: parseNumOrNull(formData.get('foto_evidencia_precision_m')),
        calidad_score: parseNumOrNull(formData.get('foto_evidencia_calidad_score')),
        resolucion_px: (formData.get('foto_evidencia_resolucion') as string | null) || null,
      })
    }

    for (const ifoto of itemFotosSubidas) {
      fotosAInsertar.push({
        recepcion_id: recepcionId,
        tipo_foto: ifoto.estado === 'danado' ? 'dano_evidencia' : 'material_completo',
        storage_path: ifoto.storage_path,
        foto_url: ifoto.foto_url,
        capturado_por: session.authUserId,
        latitud: ifoto.latitud,
        longitud: ifoto.longitud,
        precision_gps_m: ifoto.precision_gps_m,
        calidad_score: ifoto.calidad_score,
        resolucion_px: ifoto.resolucion_px,
      })
    }

    if (fotosAInsertar.length > 0) {
      await supabase.from('recepcion_fotos').insert(fotosAInsertar)
    }

    // Actualizar foto_url en recepcion_items si existen
    for (const ifoto of itemFotosSubidas) {
      await supabase
        .from('recepcion_items')
        .update({ foto_url: ifoto.foto_url })
        .eq('recepcion_id', recepcionId)
        .eq('orden_item_id', ifoto.orden_item_id)
    }
  } catch (fotoErr) {
    console.warn('Advertencia: No se pudieron registrar metadatos de recepcion_fotos:', fotoErr)
  }

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
  if (!matchesOfflineOwner(raw, session?.authUserId)) {
    return { status: 'no_autenticado' }
  }
  if (!session || !session.perfil || !puedeCapturarRecepcion(session.rol)) {
    return { status: 'no_autenticado' }
  }

  const parsed = validateRecepcionInput(raw)
  if (!parsed.ok) {
    return { status: 'conflicto', error: parsed.error }
  }

  const supabase = await createClient()
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
    // Prefijo estable [CONFLICTO] desde RPC; fallbacks por mensaje/código PG.
    if (
      lower.includes('[conflicto]') ||
      lower.includes('conflicto') ||
      lower.includes('ya no admite') ||
      lower.includes('no pertenece') ||
      lower.includes('sobre-recepci') ||
      lower.includes('fuera de rango') ||
      lower.includes('duplicate key') ||
      lower.includes('unique constraint') ||
      lower.includes('23505')
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

  const supabase = await createClient()
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
