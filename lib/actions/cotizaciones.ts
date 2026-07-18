'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSessionUsuario } from '@/lib/auth/session'
import { roundQuantity } from '@/lib/money'
import { puedeCotizar } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { validateCotizacionInput } from '@/lib/validations/cotizacion'
import type { MonedaOc } from '@/lib/types'

export type ActionResult = { error: string | null; ok?: boolean }

export async function createCotizacionAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !session.perfil || !puedeCotizar(session.rol)) {
    return { error: 'No tienes permiso para cotizar.' }
  }

  let itemsRaw: unknown = []
  const itemsJson = formData.get('items_json')
  if (typeof itemsJson === 'string' && itemsJson.trim() !== '') {
    try {
      itemsRaw = JSON.parse(itemsJson)
    } catch {
      return { error: 'No se pudieron leer los renglones de cotización.' }
    }
  }

  const parsed = validateCotizacionInput({
    solicitud_id: formData.get('solicitud_id'),
    nota: formData.get('nota'),
    items: itemsRaw,
  })

  if (!parsed.ok) return { error: parsed.error }

  const supabase = createClient()

  const { data: solicitud } = await supabase
    .from('solicitudes_material')
    .select('id, estado, obra_id, solicitante_id')
    .eq('id', parsed.data.solicitud_id)
    .maybeSingle()

  if (!solicitud) {
    return { error: 'La solicitud no existe.' }
  }
  if (solicitud.estado !== 'pendiente' && solicitud.estado !== 'en_cotizacion') {
    return { error: 'Esta solicitud ya no se puede cotizar.' }
  }

  const { data: solicitudItems } = await supabase
    .from('solicitud_items')
    .select('id')
    .eq('solicitud_id', solicitud.id)

  const idsValidos = new Set((solicitudItems ?? []).map((i) => i.id))
  for (const item of parsed.data.items) {
    if (!idsValidos.has(item.solicitud_item_id)) {
      return { error: 'Uno de los renglones no pertenece a esta solicitud.' }
    }
  }

  const { data: cotizacion, error: errorCot } = await supabase
    .from('cotizaciones')
    .insert({
      solicitud_id: solicitud.id,
      cotizador_id: session.perfil.id,
      estado: 'borrador',
      nota: parsed.data.nota,
    })
    .select('id')
    .single()

  if (errorCot || !cotizacion) {
    return { error: 'No se pudo crear la cotización. Intenta de nuevo.' }
  }

  const { error: errorItems } = await supabase.from('cotizacion_items').insert(
    parsed.data.items.map((item) => ({
      cotizacion_id: cotizacion.id,
      solicitud_item_id: item.solicitud_item_id,
      proveedor_id: item.proveedor_id,
      precio_unitario: item.precio_unitario,
      cantidad: item.cantidad,
      moneda: item.moneda,
    }))
  )

  if (errorItems) {
    await supabase.from('cotizaciones').delete().eq('id', cotizacion.id)
    return { error: 'No se pudieron guardar los precios. Intenta de nuevo.' }
  }

  if (solicitud.estado === 'pendiente') {
    const { error: errorEstado } = await supabase
      .from('solicitudes_material')
      .update({ estado: 'en_cotizacion' })
      .eq('id', solicitud.id)

    if (errorEstado) {
      return {
        error: 'Cotización guardada, pero no se pudo actualizar el estado de la solicitud.',
      }
    }
  }

  revalidatePath('/solicitudes')
  revalidatePath(`/solicitudes/${solicitud.id}`)
  revalidatePath('/ordenes')
  redirect(`/solicitudes/${solicitud.id}`)
}

export async function aprobarCotizacionAction(
  cotizacionId: string,
  _prev: ActionResult,
  _formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !session.perfil || !puedeCotizar(session.rol)) {
    return { error: 'No tienes permiso para aprobar cotizaciones.' }
  }

  const supabase = createClient()

  const { data: cotizacion } = await supabase
    .from('cotizaciones')
    .select('id, solicitud_id, estado')
    .eq('id', cotizacionId)
    .maybeSingle()

  if (!cotizacion) {
    return { error: 'La cotización no existe.' }
  }
  if (cotizacion.estado !== 'borrador' && cotizacion.estado !== 'enviada') {
    return { error: 'Esta cotización ya no se puede aprobar.' }
  }

  const { data: solicitud } = await supabase
    .from('solicitudes_material')
    .select('id, obra_id, solicitante_id, estado')
    .eq('id', cotizacion.solicitud_id)
    .maybeSingle()

  if (!solicitud) {
    return { error: 'La solicitud asociada no existe.' }
  }

  const { data: items } = await supabase
    .from('cotizacion_items')
    .select(
      `id, proveedor_id, precio_unitario, cantidad, moneda,
       solicitud_item:solicitud_items(material_id)`
    )
    .eq('cotizacion_id', cotizacionId)

  if (!items || items.length === 0) {
    return { error: 'La cotización no tiene renglones.' }
  }

  type ItemRow = {
    id: string
    proveedor_id: string
    precio_unitario: number
    cantidad: number
    moneda: MonedaOc
    solicitud_item: { material_id: string } | { material_id: string }[] | null
  }

  const rows = items as unknown as ItemRow[]
  const proveedorId = rows[0].proveedor_id
  const moneda = rows[0].moneda
  if (rows.some((r) => r.proveedor_id !== proveedorId)) {
    return {
      error:
        'Para emitir una OC, todos los renglones deben ser del mismo proveedor. Separa cotizaciones por proveedor.',
    }
  }
  if (rows.some((r) => r.moneda !== moneda)) {
    return { error: 'Todos los renglones deben tener la misma moneda.' }
  }

  let total = 0
  const ocItems: {
    material_id: string
    cantidad: number
    precio_unitario: number
    subtotal: number
    cotizacion_item_id: string
  }[] = []

  for (const row of rows) {
    const si = Array.isArray(row.solicitud_item)
      ? row.solicitud_item[0]
      : row.solicitud_item
    if (!si?.material_id) {
      return { error: 'Falta el material en uno de los renglones.' }
    }
    const precio = roundQuantity(Number(row.precio_unitario))
    const cantidad = roundQuantity(Number(row.cantidad))
    const subtotal = roundQuantity(precio * cantidad)
    total = roundQuantity(total + subtotal)
    ocItems.push({
      material_id: si.material_id,
      cantidad,
      precio_unitario: precio,
      subtotal,
      cotizacion_item_id: row.id,
    })
  }

  const { data: folio, error: folioError } = await supabase.rpc('next_folio_orden_compra')
  if (folioError || typeof folio !== 'string' || folio.length === 0) {
    return { error: 'No se pudo generar el folio de la orden de compra.' }
  }

  const { data: orden, error: errorOrden } = await supabase
    .from('ordenes_compra')
    .insert({
      folio,
      cotizacion_id: cotizacion.id,
      proveedor_id: proveedorId,
      obra_id: solicitud.obra_id,
      estado: 'emitida',
      total,
      moneda,
      creado_por: session.perfil.id,
    })
    .select('id, folio')
    .single()

  if (errorOrden || !orden) {
    return { error: 'No se pudo emitir la orden de compra. Intenta de nuevo.' }
  }

  const { error: errorOcItems } = await supabase.from('orden_compra_items').insert(
    ocItems.map((item) => ({
      orden_id: orden.id,
      material_id: item.material_id,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      subtotal: item.subtotal,
      cotizacion_item_id: item.cotizacion_item_id,
    }))
  )

  if (errorOcItems) {
    await supabase.from('ordenes_compra').delete().eq('id', orden.id)
    return { error: 'No se pudieron guardar los renglones de la OC.' }
  }

  const { error: errorCotEstado } = await supabase
    .from('cotizaciones')
    .update({
      estado: 'aprobada',
      actualizado_en: new Date().toISOString(),
    })
    .eq('id', cotizacion.id)

  if (errorCotEstado) {
    return { error: 'OC emitida, pero no se pudo marcar la cotización como aprobada.' }
  }

  const { error: errorSolEstado } = await supabase
    .from('solicitudes_material')
    .update({ estado: 'aprobada' })
    .eq('id', solicitud.id)

  if (errorSolEstado) {
    return { error: 'OC emitida, pero no se pudo actualizar el estado de la solicitud.' }
  }

  await supabase.from('notificaciones').insert({
    usuario_id: solicitud.solicitante_id,
    titulo: 'Solicitud aprobada',
    mensaje: `Tu solicitud fue aprobada. Orden de compra ${orden.folio}.`,
    tipo: 'solicitud_aprobada',
    referencia_id: solicitud.id,
  })

  revalidatePath('/solicitudes')
  revalidatePath(`/solicitudes/${solicitud.id}`)
  revalidatePath('/ordenes')
  redirect(`/ordenes/${orden.id}`)
}

export async function rechazarCotizacionAction(
  cotizacionId: string,
  _prev: ActionResult,
  _formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeCotizar(session.rol)) {
    return { error: 'No tienes permiso para rechazar cotizaciones.' }
  }

  const supabase = createClient()

  const { data: cotizacion } = await supabase
    .from('cotizaciones')
    .select('id, solicitud_id, estado')
    .eq('id', cotizacionId)
    .maybeSingle()

  if (!cotizacion) {
    return { error: 'La cotización no existe.' }
  }

  const { error: errorCot } = await supabase
    .from('cotizaciones')
    .update({
      estado: 'rechazada',
      actualizado_en: new Date().toISOString(),
    })
    .eq('id', cotizacionId)

  if (errorCot) {
    return { error: 'No se pudo rechazar la cotización.' }
  }

  const { data: solicitud } = await supabase
    .from('solicitudes_material')
    .select('id, solicitante_id')
    .eq('id', cotizacion.solicitud_id)
    .maybeSingle()

  if (solicitud) {
    await supabase
      .from('solicitudes_material')
      .update({ estado: 'rechazada' })
      .eq('id', solicitud.id)

    await supabase.from('notificaciones').insert({
      usuario_id: solicitud.solicitante_id,
      titulo: 'Solicitud rechazada',
      mensaje: 'Compras rechazó tu solicitud de material.',
      tipo: 'solicitud_rechazada',
      referencia_id: solicitud.id,
    })
  }

  revalidatePath('/solicitudes')
  revalidatePath(`/solicitudes/${cotizacion.solicitud_id}`)
  return { error: null, ok: true }
}
