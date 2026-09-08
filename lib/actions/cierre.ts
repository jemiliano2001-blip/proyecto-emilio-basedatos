'use server'

import { revalidatePath } from 'next/cache'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeCerrarObra, puedeReabrirObra } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'

export type ActionResult = { error: string | null; ok?: boolean }

function rpcErrorMessage(error: { message?: string } | null, fallback: string): string {
  const msg = error?.message?.trim()
  if (!msg) return fallback
  const cleaned = msg.replace(/^.*ERROR:\s*/i, '').split('\n')[0]?.trim()
  // Ver nota en lib/actions/traspasos.ts: tope de 180 para no filtrar errores
  // crudos de Postgres a la UI.
  if (!cleaned || cleaned.length === 0 || cleaned.length >= 180) return fallback
  return cleaned
}

export async function cerrarObraAction(
  obraId: string,
  nota?: string
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !session.perfil || !puedeCerrarObra(session.rol)) {
    return { error: 'No tienes permiso para cerrar proyectos.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('cerrar_obra', {
    p_obra_id: obraId,
    p_nota: nota || null,
  })

  if (error) {
    return { error: rpcErrorMessage(error, 'No se pudo cerrar el proyecto.') }
  }

  revalidatePath('/')
  revalidatePath(`/obras/${obraId}`)
  revalidatePath(`/obras/${obraId}/conciliacion`)
  return { ok: true, error: null }
}

export async function reabrirObraAction(obraId: string): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !session.perfil || !puedeReabrirObra(session.rol)) {
    return { error: 'No tienes permiso para reabrir proyectos.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('reabrir_obra', {
    p_obra_id: obraId,
  })

  if (error) {
    return { error: rpcErrorMessage(error, 'No se pudo reabrir el proyecto.') }
  }

  revalidatePath('/')
  revalidatePath(`/obras/${obraId}`)
  revalidatePath(`/obras/${obraId}/conciliacion`)
  return { ok: true, error: null }
}
