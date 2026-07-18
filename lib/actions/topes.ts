'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarTopes } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { validateTopeInput } from '@/lib/validations/tope'

export type ActionResult = { error: string | null; ok?: boolean }

export async function createTopeAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarTopes(session.rol)) {
    return { error: 'No tienes permiso para definir topes contratados.' }
  }

  const parsed = validateTopeInput({
    obra_id: formData.get('obra_id'),
    material_id: formData.get('material_id'),
    cantidad_contratada: formData.get('cantidad_contratada'),
  })

  if (!parsed.ok) {
    return { error: parsed.error }
  }

  const supabase = createClient()
  const { error } = await supabase.from('obra_material_contratado').insert(parsed.data)

  if (error) {
    if (error.code === '23505') {
      return { error: 'Ese material ya tiene tope en esta obra. Edítalo en la lista.' }
    }
    return { error: 'No se pudo guardar el tope. Intenta de nuevo.' }
  }

  revalidatePath(`/obras/${parsed.data.obra_id}`)
  redirect(`/obras/${parsed.data.obra_id}`)
}

export async function updateTopeAction(
  topeId: string,
  obraId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarTopes(session.rol)) {
    return { error: 'No tienes permiso para editar topes contratados.' }
  }

  const parsed = validateTopeInput({
    obra_id: obraId,
    material_id: formData.get('material_id'),
    cantidad_contratada: formData.get('cantidad_contratada'),
  })

  if (!parsed.ok) {
    return { error: parsed.error }
  }

  const supabase = createClient()
  const { error } = await supabase
    .from('obra_material_contratado')
    .update({ cantidad_contratada: parsed.data.cantidad_contratada })
    .eq('id', topeId)
    .eq('obra_id', obraId)

  if (error) {
    return { error: 'No se pudo actualizar el tope. Intenta de nuevo.' }
  }

  revalidatePath(`/obras/${obraId}`)
  return { error: null, ok: true }
}
