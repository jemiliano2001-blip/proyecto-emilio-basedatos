'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { sanitizeNextPath } from '@/lib/auth/safe-next'
import { getSessionUsuario } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import type { Notificacion } from '@/lib/types'

export type NotificacionesResult = {
  error: string | null
  items: Notificacion[]
  noLeidas: number
}

function asNotificacion(row: Record<string, unknown>): Notificacion {
  return {
    id: String(row.id),
    usuario_id: row.usuario_id == null ? null : String(row.usuario_id),
    rol_destino: (row.rol_destino as Notificacion['rol_destino']) ?? null,
    titulo: String(row.titulo ?? ''),
    mensaje: String(row.mensaje ?? ''),
    tipo: String(row.tipo ?? ''),
    referencia_id: row.referencia_id == null ? null : String(row.referencia_id),
    leida: Boolean(row.leida),
    creado_en: String(row.creado_en ?? ''),
  }
}

export async function listarNotificacionesAction(): Promise<NotificacionesResult> {
  const session = await getSessionUsuario()
  if (!session || !session.perfil) {
    return { error: 'No autenticado', items: [], noLeidas: 0 }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notificaciones')
    .select(
      'id, usuario_id, rol_destino, titulo, mensaje, tipo, referencia_id, leida, creado_en'
    )
    .order('creado_en', { ascending: false })
    .limit(80)

  if (error) {
    return { error: 'No se pudieron cargar los avisos.', items: [], noLeidas: 0 }
  }

  const items = (data ?? []).map((row) => asNotificacion(row as Record<string, unknown>))
  const noLeidas = items.filter((n) => !n.leida).length
  return { error: null, items, noLeidas }
}

export async function contarNoLeidasAction(): Promise<{ error: string | null; noLeidas: number }> {
  const session = await getSessionUsuario()
  if (!session || !session.perfil) {
    return { error: 'No autenticado', noLeidas: 0 }
  }

  const supabase = await createClient()
  const { count, error } = await supabase
    .from('notificaciones')
    .select('id', { count: 'exact', head: true })
    .eq('leida', false)

  if (error) {
    return { error: 'No se pudo contar avisos.', noLeidas: 0 }
  }

  return { error: null, noLeidas: count ?? 0 }
}

export async function marcarNotificacionLeidaAction(
  id: string
): Promise<{ error: string | null }> {
  const session = await getSessionUsuario()
  if (!session || !session.perfil) {
    return { error: 'No autenticado' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('notificaciones').update({ leida: true }).eq('id', id)

  if (error) {
    return { error: 'No se pudo marcar como leído.' }
  }

  revalidatePath('/notificaciones')
  return { error: null }
}

export async function marcarNotificacionLeidaFormAction(id: string, _formData: FormData): Promise<void> {
  await marcarNotificacionLeidaAction(id)
}

export async function abrirNotificacionAction(id: string, href: string, _formData: FormData): Promise<void> {
  const next = sanitizeNextPath(href)
  await marcarNotificacionLeidaAction(id)
  redirect(next)
}
