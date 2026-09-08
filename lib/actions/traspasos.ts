'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSessionUsuario } from '@/lib/auth/session'
import {
  puedeAprobarTraspaso,
  puedeConfirmarTraspaso,
  puedeSolicitarTraspaso,
} from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'

export type ActionResult = { error: string | null; ok?: boolean; id?: string }

function rpcErrorMessage(error: { message?: string } | null, fallback: string): string {
  const msg = error?.message?.trim()
  if (!msg) return fallback
  const cleaned = msg.replace(/^.*ERROR:\s*/i, '').split('\n')[0]?.trim()
  // Los `raise exception` de nuestras RPCs son mensajes cortos en español y
  // están pensados para el usuario. Cualquier cosa larga es un error crudo de
  // Postgres (constraints, stack) que no tiene por qué salir en pantalla.
  // Mismo tope de 180 que lib/actions/solicitudes.ts.
  if (!cleaned || cleaned.length === 0 || cleaned.length >= 180) return fallback
  return cleaned
}

export async function crearTraspasoAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !session.perfil || !puedeSolicitarTraspaso(session.rol)) {
    return { error: 'No tienes permiso para solicitar traspasos.' }
  }

  const obra_origen_id = formData.get('obra_origen_id')?.toString().trim()
  const obra_destino_id = formData.get('obra_destino_id')?.toString().trim()
  const motivo = formData.get('motivo')?.toString().trim() || null
  const itemsJson = formData.get('items_json')?.toString().trim()

  if (!obra_origen_id || !obra_destino_id) {
    return { error: 'Debe seleccionar la obra de origen y de destino.' }
  }

  if (obra_origen_id === obra_destino_id) {
    return { error: 'La obra de origen y de destino no pueden ser la misma.' }
  }

  if (!itemsJson) {
    return { error: 'Debe incluir al menos un material para el traspaso.' }
  }

  let items: Array<{ material_id: string; cantidad: number }> = []
  try {
    items = JSON.parse(itemsJson)
  } catch {
    return { error: 'Formato de materiales inválido.' }
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { error: 'Debe incluir al menos un material para el traspaso.' }
  }

  for (const item of items) {
    if (
      !item.material_id ||
      typeof item.cantidad !== 'number' ||
      !Number.isFinite(item.cantidad) ||
      item.cantidad <= 0
    ) {
      return { error: 'Verifique los materiales y cantidades ingresadas.' }
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('crear_solicitud_traspaso', {
    p_obra_origen_id: obra_origen_id,
    p_obra_destino_id: obra_destino_id,
    p_motivo: motivo,
    p_items: items,
  })

  if (error) {
    return { error: rpcErrorMessage(error, 'No se pudo registrar la solicitud de traspaso.') }
  }

  const traspasoId = typeof data === 'string' ? data : null
  revalidatePath('/traspasos')
  if (traspasoId) {
    revalidatePath(`/traspasos/${traspasoId}`)
    redirect(`/traspasos/${traspasoId}`)
  } else {
    redirect('/traspasos')
  }
}

export async function aprobarTraspasoAction(
  traspasoId: string
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !session.perfil || !puedeAprobarTraspaso(session.rol)) {
    return { error: 'No tienes permiso para aprobar traspasos.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('aprobar_traspaso', {
    p_traspaso_id: traspasoId,
  })

  if (error) {
    return { error: rpcErrorMessage(error, 'No se pudo aprobar el traspaso.') }
  }

  revalidatePath('/traspasos')
  revalidatePath(`/traspasos/${traspasoId}`)
  return { ok: true, error: null }
}

export async function confirmarRecepcionTraspasoAction(
  traspasoId: string
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !session.perfil || !puedeConfirmarTraspaso(session.rol)) {
    return { error: 'No tienes permiso para confirmar la recepción del traspaso.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('confirmar_recepcion_traspaso', {
    p_traspaso_id: traspasoId,
  })

  if (error) {
    return { error: rpcErrorMessage(error, 'No se pudo confirmar la recepción.') }
  }

  revalidatePath('/traspasos')
  revalidatePath(`/traspasos/${traspasoId}`)
  return { ok: true, error: null }
}

export async function rechazarTraspasoAction(
  traspasoId: string,
  motivo: string
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !session.perfil || !puedeAprobarTraspaso(session.rol)) {
    return { error: 'No tienes permiso para rechazar traspasos.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('rechazar_traspaso', {
    p_traspaso_id: traspasoId,
    p_motivo: motivo,
  })

  if (error) {
    return { error: rpcErrorMessage(error, 'No se pudo rechazar el traspaso.') }
  }

  revalidatePath('/traspasos')
  revalidatePath(`/traspasos/${traspasoId}`)
  return { ok: true, error: null }
}

export async function cancelarTraspasoAction(
  traspasoId: string
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !session.perfil) {
    return { error: 'No autenticado.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('cancelar_traspaso', {
    p_traspaso_id: traspasoId,
  })

  if (error) {
    return { error: rpcErrorMessage(error, 'No se pudo cancelar el traspaso.') }
  }

  revalidatePath('/traspasos')
  revalidatePath(`/traspasos/${traspasoId}`)
  return { ok: true, error: null }
}
