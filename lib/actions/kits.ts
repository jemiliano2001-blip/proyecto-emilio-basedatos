'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarKits } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { validateMaterialKitInput } from '@/lib/validations/kit'

export type ActionResult = { error: string | null; ok?: boolean }

export async function createKitAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarKits(session.rol)) {
    return { error: 'No tienes permiso para gestionar kits de materiales.' }
  }

  const parsed = validateMaterialKitInput({
    nombre: formData.get('nombre'),
    material_principal_id: formData.get('material_principal_id'),
    configuracion: formData.get('configuracion'),
    descripcion: formData.get('descripcion'),
    items_json: formData.get('items_json'),
    activo: formData.get('activo') !== 'false',
  })

  if (!parsed.ok) {
    return { error: parsed.error }
  }

  const { items, ...kitData } = parsed.data
  const supabase = await createClient()

  const { error } = await supabase.rpc('crear_kit_con_items', {
    p_datos: kitData,
    p_items: items,
  })

  if (error) {
    return { error: 'No se pudo registrar el kit completo. Intenta de nuevo.' }
  }

  revalidatePath('/kits')
  revalidatePath('/obras/nueva')
  redirect('/kits')
}

export async function updateKitAction(
  kitId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarKits(session.rol)) {
    return { error: 'No tienes permiso para gestionar kits de materiales.' }
  }

  const parsed = validateMaterialKitInput({
    nombre: formData.get('nombre'),
    material_principal_id: formData.get('material_principal_id'),
    configuracion: formData.get('configuracion'),
    descripcion: formData.get('descripcion'),
    items_json: formData.get('items_json'),
    activo: formData.get('activo') !== 'false',
  })

  if (!parsed.ok) {
    return { error: parsed.error }
  }

  const { items, ...kitData } = parsed.data
  const supabase = await createClient()

  const { error } = await supabase.rpc('actualizar_kit_con_items', {
    p_kit_id: kitId,
    p_datos: kitData,
    p_items: items,
  })

  if (error) {
    return { error: 'No se pudo actualizar el kit completo. Intenta de nuevo.' }
  }

  revalidatePath('/kits')
  revalidatePath('/obras/nueva')
  redirect('/kits')
}

export async function deleteKitAction(kitId: string): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarKits(session.rol)) {
    return { error: 'No tienes permiso para eliminar kits.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('material_kits').delete().eq('id', kitId)

  if (error) {
    return { error: 'No se pudo eliminar el kit seleccionado.' }
  }

  revalidatePath('/kits')
  revalidatePath('/obras/nueva')
  return { error: null, ok: true }
}
