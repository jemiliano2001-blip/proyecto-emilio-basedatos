'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarObras } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { validateObraInput } from '@/lib/validations/obra'

export type ActionResult = { error: string | null; ok?: boolean }

export async function createObraAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarObras(session.rol)) {
    return { error: 'No tienes permiso para crear obras.' }
  }

  const parsed = validateObraInput({
    nombre: formData.get('nombre'),
    fraccionamiento: formData.get('fraccionamiento'),
    paquete: formData.get('paquete'),
    ubicacion: formData.get('ubicacion'),
    estado: formData.get('estado') || 'activa',
  })

  if (!parsed.ok) {
    return { error: parsed.error }
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('obras')
    .insert({
      ...parsed.data,
      cerrado_en: parsed.data.estado === 'cerrada' ? new Date().toISOString() : null,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { error: 'No se pudo crear la obra. Intenta de nuevo.' }
  }

  revalidatePath('/')
  redirect(`/obras/${data.id}`)
}

export async function updateObraAction(
  obraId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarObras(session.rol)) {
    return { error: 'No tienes permiso para editar obras.' }
  }

  const parsed = validateObraInput({
    nombre: formData.get('nombre'),
    fraccionamiento: formData.get('fraccionamiento'),
    paquete: formData.get('paquete'),
    ubicacion: formData.get('ubicacion'),
    estado: formData.get('estado') || 'activa',
  })

  if (!parsed.ok) {
    return { error: parsed.error }
  }

  const supabase = createClient()
  const { error } = await supabase
    .from('obras')
    .update({
      ...parsed.data,
      cerrado_en: parsed.data.estado === 'cerrada' ? new Date().toISOString() : null,
    })
    .eq('id', obraId)

  if (error) {
    return { error: 'No se pudo actualizar la obra. Intenta de nuevo.' }
  }

  revalidatePath('/')
  revalidatePath(`/obras/${obraId}`)
  redirect(`/obras/${obraId}`)
}
