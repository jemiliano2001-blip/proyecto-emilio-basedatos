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

  const supabase = await createClient()
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

  const supabase = await createClient()
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

export async function asignarMaterialesMasivosAction(
  obraId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarTopes(session.rol)) {
    return { error: 'No tienes permiso para asignar materiales al proyecto.' }
  }

  const partidasRaw = formData.get('partidas_json')
  if (typeof partidasRaw !== 'string' || partidasRaw.trim() === '') {
    return { error: 'No se encontraron partidas para asignar.' }
  }

  let partidas: { material_id: string; cantidad: number }[] = []
  try {
    const parsed = JSON.parse(partidasRaw)
    if (!Array.isArray(parsed)) throw new Error('Formato inválido')
    partidas = parsed
      .filter((p) => p && typeof p.material_id === 'string' && Number(p.cantidad) > 0)
      .map((p) => ({
        material_id: String(p.material_id).trim(),
        cantidad: Number(p.cantidad),
      }))
  } catch {
    return { error: 'Error al interpretar los materiales asignados.' }
  }

  if (partidas.length === 0) {
    return { error: 'Agrega al menos un material con cantidad mayor a 0.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('asignar_materiales_proyecto', {
    p_obra_id: obraId,
    p_partidas: partidas,
  })

  if (error) {
    return { error: 'No se pudieron asignar todos los materiales. No se aplicó ningún cambio.' }
  }

  revalidatePath(`/obras/${obraId}`)
  revalidatePath('/')
  redirect(`/obras/${obraId}`)
}

export async function eliminarMaterialObraAction(
  obraId: string,
  materialId: string
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarTopes(session.rol)) {
    return { error: 'No tienes permiso para eliminar materiales asignados.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('obra_material_contratado')
    .delete()
    .eq('obra_id', obraId)
    .eq('material_id', materialId)
    .select('id')

  if (error) {
    return { error: 'No se pudo eliminar el material del proyecto. Intenta de nuevo.' }
  }
  if (!data || data.length === 0) {
    return {
      error:
        'No se eliminó el material. Puede que ya no esté asignado o falte permiso en la base (política de borrado).',
    }
  }

  revalidatePath(`/obras/${obraId}`)
  revalidatePath('/')
  return { error: null, ok: true }
}

export async function eliminarTodosMaterialesObraAction(
  obraId: string
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarTopes(session.rol)) {
    return { error: 'No tienes permiso para eliminar los materiales del proyecto.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('obra_material_contratado')
    .delete()
    .eq('obra_id', obraId)
    .select('id')

  if (error) {
    return { error: 'No se pudieron eliminar los materiales del proyecto. Intenta de nuevo.' }
  }
  if (!data || data.length === 0) {
    return {
      error:
        'No se eliminó ningún material. Revisa que haya partidas asignadas o que la política de borrado esté aplicada.',
    }
  }

  revalidatePath(`/obras/${obraId}`)
  revalidatePath('/')
  return { error: null, ok: true }
}
