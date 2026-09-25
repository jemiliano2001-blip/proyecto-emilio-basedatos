'use server'

import { matchesOfflineOwner } from '@/lib/offline/owner'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSessionUsuario } from '@/lib/auth/session'
import {
  puedeAprobarCompras,
  puedeAprobarPago,
  puedeCrearSolicitudes,
  puedeCrearSolicitudMultiObra,
} from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { esRelacionAusente } from '@/lib/schema-disponible'
import { validateSolicitudInput, type SolicitudItemInput } from '@/lib/validations/solicitud'

export type ActionResult = { error: string | null; ok?: boolean }

function mapRpcError(error: { message?: string } | null, fallback: string): string {
  const msg = error?.message ?? ''
  if (msg.includes('Saldo insuficiente en partida')) {
    return msg
  }
  if (msg.includes('Presupuesto monetario insuficiente')) {
    return msg
  }
  if (msg.includes('no tiene presupuesto')) {
    return msg
  }
  if (msg.includes('debe conservar al menos una partida')) {
    return msg
  }
  if (msg.includes('Saldo de cantidad insuficiente')) {
    return 'Saldo de cantidad insuficiente para un material.'
  }
  if (msg.includes('Falta el precio cotizado')) {
    return 'Captura el precio cotizado en todos los materiales antes de aprobar.'
  }
  if (msg.includes('precio cotizado no puede ser negativo')) {
    return 'El precio cotizado no puede ser negativo.'
  }
  if (msg.length > 0 && msg.length < 240) return msg
  return fallback
}

async function insertSolicitudItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  solicitudId: string,
  items: SolicitudItemInput[]
) {
  return supabase.from('solicitud_items').insert(
    items.map((item) => ({
      solicitud_id: solicitudId,
      tipo_linea: item.tipo_linea,
      material_id: item.material_id,
      cantidad_solicitada: item.cantidad_solicitada,
      descripcion: item.descripcion,
      monto_mxn: item.monto_mxn,
      nota: item.nota,
      obra_id: item.obra_id,
    }))
  )
}

export async function createSolicitudAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !session.perfil || !puedeCrearSolicitudes(session.rol)) {
    return { error: 'No tienes permiso para levantar requisiciones.' }
  }

  let itemsRaw: unknown = []
  const itemsJson = formData.get('items_json')
  if (typeof itemsJson === 'string' && itemsJson.trim() !== '') {
    try {
      itemsRaw = JSON.parse(itemsJson)
    } catch {
      return { error: 'No se pudieron leer los renglones. Intenta de nuevo.' }
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

  if (
    parsed.data.items.some((item) => item.obra_id !== null) &&
    !puedeCrearSolicitudMultiObra(session.rol)
  ) {
    return { error: 'No tienes permiso para requisiciones multi-obra.' }
  }

  const supabase = await createClient()
  const solicitanteId = session.perfil.id

  const { data: obra } = await supabase
    .from('obras')
    .select('id, estado')
    .eq('id', parsed.data.obra_id)
    .maybeSingle()

  if (!obra) {
    return { error: 'El proyecto seleccionado no existe.' }
  }
  if (obra.estado !== 'activa') {
    return { error: 'Solo puedes solicitar para proyectos activos.' }
  }

  const materialIds = [
    ...new Set(
      parsed.data.items
        .filter((item) => item.tipo_linea === 'material' && item.material_id)
        .map((item) => item.material_id as string)
    ),
  ]

  if (materialIds.length > 0) {
    const { data: materiales } = await supabase
      .from('catalogo_materiales')
      .select('id, nombre_base, variante, activo')
      .in('id', materialIds)

    if (!materiales || materiales.length !== materialIds.length) {
      return { error: 'Uno o más materiales de la requisición no existen.' }
    }
    if (materiales.some((m) => !m.activo)) {
      return { error: 'Uno o más materiales están inactivos. Quítalos de la requisición.' }
    }

    // Validación estricta de saldo disponible en campo (deduciendo provisionalmente pendientes)
    const matMap = new Map(materiales.map((m) => [m.id, m]))
    const { data: saldos } = await supabase
      .from('v_saldo_material_obra')
      .select('obra_id, material_id, cantidad_disponible, cantidad_comprometida, cantidad_en_proceso')
      .in('material_id', materialIds)

    const { data: itemsPendientes } = await supabase
      .from('solicitud_items')
      .select('material_id, obra_id, cantidad_solicitada, solicitud:solicitudes_material!inner(id, obra_id, estado)')
      .in('material_id', materialIds)
      .in('solicitud.estado', ['recibida', 'pendiente'])

    const pendientesMap = new Map<string, number>()
    for (const p of itemsPendientes ?? []) {
      const sol = Array.isArray(p.solicitud) ? p.solicitud[0] : p.solicitud
      const itemObraId = p.obra_id || sol?.obra_id
      if (itemObraId && p.material_id && p.cantidad_solicitada) {
        const key = `${itemObraId}_${p.material_id}`
        pendientesMap.set(key, (pendientesMap.get(key) ?? 0) + Number(p.cantidad_solicitada))
      }
    }

    const saldoLookup = new Map(
      (saldos ?? []).map((s) => {
        const key = `${s.obra_id}_${s.material_id}`
        const pendiente = pendientesMap.get(key) ?? 0
        const rawDisp = Number(s.cantidad_disponible ?? 0)
        const rawComp = Number(s.cantidad_comprometida ?? s.cantidad_en_proceso ?? 0)
        const yaIncluido = rawComp >= pendiente && pendiente > 0
        const neto = Math.max(0, Math.round((rawDisp - (yaIncluido ? 0 : pendiente)) * 100) / 100)
        return [key, neto]
      })
    )

    for (const item of parsed.data.items) {
      if (item.tipo_linea === 'material' && item.material_id) {
        const itemObraId = item.obra_id ?? parsed.data.obra_id
        const key = `${itemObraId}_${item.material_id}`
        const mat = matMap.get(item.material_id)
        const matNombre = mat ? `${mat.nombre_base}${mat.variante ? ` · ${mat.variante}` : ''}` : 'Material'

        if (!saldoLookup.has(key)) {
          return {
            error: `El material "${matNombre}" no tiene presupuesto asignado en este proyecto.`,
          }
        }

        const disponible = saldoLookup.get(key)!
        if (disponible <= 0) {
          return {
            error: `Saldo insuficiente: El material "${matNombre}" no tiene saldo disponible en este proyecto (Disponible: 0).`,
          }
        }

        const cantSol = item.cantidad_solicitada ?? 0
        if (cantSol > disponible) {
          return {
            error: `Saldo insuficiente: Para "${matNombre}" solicitas ${cantSol}, pero solo hay ${disponible} disponible.`,
          }
        }
      }
    }
  }

  // 1. Creación atómica en PostgreSQL (Migración 0017)
  const { data: rpcId, error: errorRpc } = await supabase.rpc('crear_solicitud_con_items', {
    p_obra_id: parsed.data.obra_id,
    p_nota: parsed.data.nota,
    p_items: parsed.data.items,
  })

  if (!errorRpc && typeof rpcId === 'string') {
    revalidatePath('/solicitudes')
    revalidatePath(`/solicitudes/${rpcId}`)
    redirect(`/solicitudes/${rpcId}`)
  }

  if (errorRpc && !esRelacionAusente(errorRpc)) {
    return { error: mapRpcError(errorRpc, 'No se pudo crear la requisición. Intenta de nuevo.') }
  }

  // 2. Fallback de compatibilidad
  const { data: solicitud, error: errorSolicitud } = await supabase
    .from('solicitudes_material')
    .insert({
      obra_id: parsed.data.obra_id,
      solicitante_id: solicitanteId,
      nota: parsed.data.nota,
      estado: 'recibida',
    })
    .select('id')
    .single()

  if (errorSolicitud || !solicitud) {
    // Fallback si el enum nuevo aún no está aplicado: intentar sin estado explícito
    if (errorSolicitud?.message?.includes('recibida')) {
      const retry = await supabase
        .from('solicitudes_material')
        .insert({
          obra_id: parsed.data.obra_id,
          solicitante_id: solicitanteId,
          nota: parsed.data.nota,
        })
        .select('id')
        .single()
      if (retry.error || !retry.data) {
        return { error: 'No se pudo crear la requisición. Intenta de nuevo.' }
      }
      const { error: errorItems } = await insertSolicitudItems(
        supabase,
        retry.data.id,
        parsed.data.items
      )
      if (errorItems) {
        await supabase.from('solicitudes_material').delete().eq('id', retry.data.id)
        return { error: 'No se pudieron guardar los renglones. Intenta de nuevo.' }
      }
      await supabase.from('notificaciones').insert({
        rol_destino: 'compras',
        titulo: 'Nueva requisición',
        mensaje: `${session.perfil.nombre} levantó una requisición con ${parsed.data.items.length} renglón(es).`,
        tipo: 'solicitud_nueva',
        referencia_id: retry.data.id,
      })
      revalidatePath('/solicitudes')
      redirect(`/solicitudes/${retry.data.id}`)
    }
    return { error: 'No se pudo crear la requisición. Intenta de nuevo.' }
  }

  const { error: errorItems } = await insertSolicitudItems(
    supabase,
    solicitud.id,
    parsed.data.items
  )

  if (errorItems) {
    await supabase.from('solicitudes_material').delete().eq('id', solicitud.id)
    return { error: 'No se pudieron guardar los renglones. Intenta de nuevo.' }
  }

  await supabase.from('notificaciones').insert({
    rol_destino: 'compras',
    titulo: 'Nueva requisición',
    mensaje: `${session.perfil.nombre} levantó una requisición con ${parsed.data.items.length} renglón(es).`,
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
  if (!matchesOfflineOwner(raw, session?.authUserId)) {
    return { status: 'no_autenticado' }
  }
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

  if (
    parsed.data.items.some((item) => item.obra_id !== null) &&
    !puedeCrearSolicitudMultiObra(session.rol)
  ) {
    return { status: 'conflicto', error: 'No tienes permiso para requisiciones multi-obra.' }
  }

  const supabase = await createClient()

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
    return { status: 'conflicto', error: 'El proyecto seleccionado no existe.' }
  }
  if (obra.estado !== 'activa') {
    return { status: 'conflicto', error: 'Solo puedes solicitar para proyectos activos.' }
  }

  const materialIds = [
    ...new Set(
      parsed.data.items
        .filter((item) => item.tipo_linea === 'material' && item.material_id)
        .map((item) => item.material_id as string)
    ),
  ]

  if (materialIds.length > 0) {
    const { data: materiales } = await supabase
      .from('catalogo_materiales')
      .select('id, nombre_base, variante, activo')
      .in('id', materialIds)

    if (!materiales || materiales.length !== materialIds.length) {
      return { status: 'conflicto', error: 'Uno o más materiales no existen.' }
    }
    if (materiales.some((m) => !m.activo)) {
      return { status: 'conflicto', error: 'Uno o más materiales están inactivos.' }
    }

    // Validación estricta de saldo disponible
    const matMap = new Map(materiales.map((m) => [m.id, m]))
    const { data: saldos } = await supabase
      .from('v_saldo_material_obra')
      .select('obra_id, material_id, cantidad_disponible')
      .in('material_id', materialIds)

    const saldoLookup = new Map(
      (saldos ?? []).map((s) => [`${s.obra_id}_${s.material_id}`, Number(s.cantidad_disponible ?? 0)])
    )

    for (const item of parsed.data.items) {
      if (item.tipo_linea === 'material' && item.material_id) {
        const itemObraId = item.obra_id ?? parsed.data.obra_id
        const key = `${itemObraId}_${item.material_id}`
        const mat = matMap.get(item.material_id)
        const matNombre = mat ? `${mat.nombre_base}${mat.variante ? ` · ${mat.variante}` : ''}` : 'Material'

        if (!saldoLookup.has(key)) {
          return {
            status: 'conflicto',
            error: `El material "${matNombre}" no tiene presupuesto asignado en este proyecto.`,
          }
        }

        const disponible = saldoLookup.get(key)!
        if (disponible <= 0) {
          return {
            status: 'conflicto',
            error: `Saldo insuficiente: El material "${matNombre}" no tiene saldo disponible en este proyecto (Disponible: 0).`,
          }
        }

        const cantSol = item.cantidad_solicitada ?? 0
        if (cantSol > disponible) {
          return {
            status: 'conflicto',
            error: `Saldo insuficiente: Para "${matNombre}" solicitas ${cantSol}, pero solo hay ${disponible} disponible.`,
          }
        }
      }
    }
  }

  const { data: solicitud, error: errorSolicitud } = await supabase
    .from('solicitudes_material')
    .insert({
      id: clientId,
      obra_id: parsed.data.obra_id,
      solicitante_id: session.perfil.id,
      nota: parsed.data.nota,
      estado: 'recibida',
    })
    .select('id')
    .single()

  if (errorSolicitud || !solicitud) {
    return {
      status: 'reintentar',
      error: 'No se pudo crear la requisición. Intenta de nuevo.',
    }
  }

  const { error: errorItems } = await insertSolicitudItems(
    supabase,
    solicitud.id,
    parsed.data.items
  )

  if (errorItems) {
    await supabase.from('solicitudes_material').delete().eq('id', solicitud.id)
    return {
      status: 'reintentar',
      error: 'No se pudieron guardar los renglones.',
    }
  }

  await supabase.from('notificaciones').insert({
    rol_destino: 'compras',
    titulo: 'Nueva requisición',
    mensaje: `${session.perfil.nombre} levantó una requisición con ${parsed.data.items.length} renglón(es).`,
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

  const supabase = await createClient()
  const { error } = await supabase.rpc('cancelar_solicitud', {
    p_solicitud_id: solicitudId,
  })

  if (error) {
    // Fallback directo si la RPC aún no existe
    const { data: solicitud } = await supabase
      .from('solicitudes_material')
      .select('id, solicitante_id, estado')
      .eq('id', solicitudId)
      .maybeSingle()

    if (!solicitud) {
      return { error: 'La solicitud ya no existe.' }
    }

    const esDueno = solicitud.solicitante_id === session.perfil.id
    const estadoCancelable =
      solicitud.estado === 'recibida' || solicitud.estado === 'pendiente'
    const puedeCancelar =
      session.rol === 'acceso_total' || (esDueno && estadoCancelable)

    if (!puedeCancelar) {
      return { error: mapRpcError(error, 'No puedes cancelar esta solicitud.') }
    }

    const { error: updateError } = await supabase
      .from('solicitudes_material')
      .update({ estado: 'cancelada', cancelado_en: new Date().toISOString() })
      .eq('id', solicitudId)

    if (updateError) {
      return { error: 'No se pudo cancelar la solicitud. Intenta de nuevo.' }
    }
  }

  revalidatePath('/solicitudes')
  revalidatePath(`/solicitudes/${solicitudId}`)
  return { error: null, ok: true }
}

export async function eliminarPartidaSolicitudAction(
  solicitudId: string,
  itemId: string
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeAprobarCompras(session.rol)) {
    return { error: 'No tienes permiso para modificar partidas de la requisición.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('eliminar_item_solicitud', {
    p_solicitud_id: solicitudId,
    p_item_id: itemId,
  })

  if (error) {
    if (esRelacionAusente(error) || error.message?.includes('eliminar_item_solicitud')) {
      const { data: sol } = await supabase
        .from('solicitudes_material')
        .select('estado')
        .eq('id', solicitudId)
        .maybeSingle()
      if (sol?.estado === 'recibida' || sol?.estado === 'pendiente') {
        const { count } = await supabase
          .from('solicitud_items')
          .select('id', { count: 'exact', head: true })
          .eq('solicitud_id', solicitudId)
        if ((count ?? 0) > 1) {
          const { error: delErr } = await supabase
            .from('solicitud_items')
            .delete()
            .eq('id', itemId)
            .eq('solicitud_id', solicitudId)
          if (!delErr) {
            revalidatePath('/solicitudes')
            revalidatePath(`/solicitudes/${solicitudId}`)
            return { error: null, ok: true }
          }
        } else {
          return { error: 'La requisición debe conservar al menos una partida. Si deseas anularla completa, utiliza Rechazar.' }
        }
      }
    }
    return { error: mapRpcError(error, 'No se pudo eliminar la partida.') }
  }

  revalidatePath('/solicitudes')
  revalidatePath(`/solicitudes/${solicitudId}`)
  return { error: null, ok: true }
}

export async function aprobarSolicitudComprasAction(
  solicitudId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeAprobarCompras(session.rol)) {
    return { error: 'No tienes permiso para aprobar como Compras.' }
  }

  const precios: {
    item_id: string
    precio_unitario: number
    cantidad_solicitada?: number
    proveedor_id?: string | null
  }[] = []

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('precio_unitario_')) continue
    const itemId = key.slice('precio_unitario_'.length)
    const raw = String(value).trim().replace(',', '.')
    if (!raw) {
      return { error: 'Captura el precio cotizado en todos los materiales.' }
    }
    const precio = Number(raw)
    if (!Number.isFinite(precio) || precio < 0) {
      return { error: 'Hay un precio cotizado inválido.' }
    }

    const rawCant = formData.get(`cantidad_${itemId}`)
    let cantidad: number | undefined = undefined
    if (rawCant !== null && rawCant !== undefined && String(rawCant).trim() !== '') {
      const parsedCant = Number(String(rawCant).trim().replace(',', '.'))
      if (!Number.isFinite(parsedCant) || parsedCant <= 0) {
        return { error: 'La cantidad debe ser mayor a cero en todas las partidas.' }
      }
      cantidad = Math.round(parsedCant * 100) / 100
    }

    const rawProv = formData.get(`proveedor_${itemId}`)
    let proveedorId: string | null = null
    if (rawProv && String(rawProv).trim()) {
      proveedorId = String(rawProv).trim()
    }

    precios.push({
      item_id: itemId,
      precio_unitario: Math.round(precio * 100) / 100,
      ...(cantidad !== undefined ? { cantidad_solicitada: cantidad } : {}),
      ...(proveedorId ? { proveedor_id: proveedorId } : {}),
    })
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('aprobar_solicitud_compras', {
    p_solicitud_id: solicitudId,
    p_precios: precios,
  })

  if (error) {
    return { error: mapRpcError(error, 'No se pudo aprobar la requisición.') }
  }

  revalidatePath('/solicitudes')
  revalidatePath(`/solicitudes/${solicitudId}`)
  revalidatePath('/')
  redirect('/solicitudes?estatus=recibida')
}

export async function aprobarPagoSolicitudAction(
  solicitudId: string,
  _prev: ActionResult,
  _formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeAprobarPago(session.rol)) {
    return { error: 'No tienes permiso para aprobar el pago.' }
  }

  const supabase = await createClient()
  const { data: _ordenesEmitidas, error } = await supabase.rpc('aprobar_pago_solicitud', {
    p_solicitud_id: solicitudId,
  })

  if (error) {
    return { error: mapRpcError(error, 'No se pudo registrar el pago.') }
  }

  revalidatePath('/solicitudes')
  revalidatePath(`/solicitudes/${solicitudId}`)
  revalidatePath('/ordenes')
  revalidatePath('/')
  redirect('/solicitudes?estatus=en_proceso')
}

export async function rechazarSolicitudAction(
  solicitudId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (
    !session ||
    (!puedeAprobarCompras(session.rol) && !puedeAprobarPago(session.rol))
  ) {
    return { error: 'No tienes permiso para rechazar requisiciones.' }
  }

  const motivoRaw = formData.get('motivo')
  const motivo =
    typeof motivoRaw === 'string' && motivoRaw.trim() !== '' ? motivoRaw.trim() : null

  const supabase = await createClient()
  const { error } = await supabase.rpc('rechazar_solicitud', {
    p_solicitud_id: solicitudId,
    p_motivo: motivo,
  })

  if (error) {
    return { error: mapRpcError(error, 'No se pudo rechazar la requisición.') }
  }

  revalidatePath('/solicitudes')
  revalidatePath(`/solicitudes/${solicitudId}`)
  revalidatePath('/')
  return { error: null, ok: true }
}

export type BatchActionResult = {
  exitosas: number
  fallidas: number
  errores: string[]
  error?: string | null
}

export async function aprobarMultiplesSolicitudesAction(
  solicitudIds: string[]
): Promise<BatchActionResult> {
  const session = await getSessionUsuario()
  if (!session || (!puedeAprobarCompras(session.rol) && !puedeAprobarPago(session.rol))) {
    return { exitosas: 0, fallidas: solicitudIds.length, errores: ['Sin permisos para aprobar.'], error: 'Sin permisos.' }
  }

  const supabase = await createClient()
  let exitosas = 0
  let fallidas = 0
  const errores: string[] = []

  for (const id of solicitudIds) {
    try {
      if (session.rol === 'finanzas') {
        const { error } = await supabase.rpc('aprobar_pago_solicitud', { p_solicitud_id: id })
        if (error) {
          fallidas++
          errores.push(`REQ-${id.slice(0, 8)}: ${mapRpcError(error, 'Error al procesar pago')}`)
        } else {
          exitosas++
        }
      } else {
        // Compras
        const { data: items } = await supabase
          .from('solicitud_items')
          .select('id, tipo_linea, cantidad_solicitada, monto_mxn, material:catalogo_materiales(precio_base)')
          .eq('solicitud_id', id)

        const precios: { item_id: string; precio_unitario: number }[] = []
        let faltaPrecio = false

        for (const item of (items ?? [])) {
          if (item.tipo_linea === 'material') {
            const cant = Number(item.cantidad_solicitada ?? 0)
            const monto = item.monto_mxn != null ? Number(item.monto_mxn) : null
            const precioBase = (item.material as { precio_base?: number | null } | null)?.precio_base != null
              ? Number((item.material as { precio_base?: number | null }).precio_base)
              : null

            const unitario = monto != null && cant > 0
              ? Math.round((monto / cant) * 100) / 100
              : precioBase != null && precioBase > 0
                ? precioBase
                : null

            if (unitario == null || unitario < 0) {
              faltaPrecio = true
              break
            }
            precios.push({ item_id: item.id, precio_unitario: unitario })
          }
        }

        if (faltaPrecio) {
          fallidas++
          errores.push(`REQ-${id.slice(0, 8)}: Requiere cotizar precios manualmente en su detalle.`)
          continue
        }

        const { error } = await supabase.rpc('aprobar_solicitud_compras', {
          p_solicitud_id: id,
          p_precios: precios,
        })
        if (error) {
          fallidas++
          errores.push(`REQ-${id.slice(0, 8)}: ${mapRpcError(error, 'Error al aprobar compras')}`)
        } else {
          exitosas++
        }
      }
    } catch (err: unknown) {
      fallidas++
      errores.push(`REQ-${id.slice(0, 8)}: ${err instanceof Error ? err.message : 'Error inesperado'}`)
    }
  }

  revalidatePath('/solicitudes')
  revalidatePath('/')
  if (session.rol === 'finanzas') revalidatePath('/ordenes')

  return { exitosas, fallidas, errores, error: errores.length > 0 && exitosas === 0 ? errores[0] : null }
}

export async function rechazarMultiplesSolicitudesAction(
  solicitudIds: string[],
  motivo?: string
): Promise<BatchActionResult> {
  const session = await getSessionUsuario()
  if (!session || (!puedeAprobarCompras(session.rol) && !puedeAprobarPago(session.rol))) {
    return { exitosas: 0, fallidas: solicitudIds.length, errores: ['Sin permisos para rechazar.'], error: 'Sin permisos.' }
  }

  const supabase = await createClient()
  let exitosas = 0
  let fallidas = 0
  const errores: string[] = []

  for (const id of solicitudIds) {
    try {
      const { error } = await supabase.rpc('rechazar_solicitud', {
        p_solicitud_id: id,
        p_motivo: motivo?.trim() || null,
      })
      if (error) {
        fallidas++
        errores.push(`REQ-${id.slice(0, 8)}: ${mapRpcError(error, 'Error al rechazar')}`)
      } else {
        exitosas++
      }
    } catch (err: unknown) {
      fallidas++
      errores.push(`REQ-${id.slice(0, 8)}: ${err instanceof Error ? err.message : 'Error inesperado'}`)
    }
  }

  revalidatePath('/solicitudes')
  revalidatePath('/')
  return { exitosas, fallidas, errores, error: errores.length > 0 && exitosas === 0 ? errores[0] : null }
}

