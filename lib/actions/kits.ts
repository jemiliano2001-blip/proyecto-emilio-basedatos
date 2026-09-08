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

  const { data: kit, error: errKit } = await supabase
    .from('material_kits')
    .insert(kitData)
    .select('id')
    .single()

  if (errKit || !kit) {
    return { error: 'No se pudo registrar el kit. Intenta de nuevo.' }
  }

  if (items.length > 0) {
    const { error: errItems } = await supabase
      .from('material_kit_items')
      .insert(
        items.map((it) => ({
          kit_id: kit.id,
          material_id: it.material_id,
          cantidad: it.cantidad,
        }))
      )

    if (errItems) {
      await supabase.from('material_kits').delete().eq('id', kit.id)
      return { error: 'No se pudieron guardar los componentes del kit.' }
    }
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

  const { error: errKit } = await supabase
    .from('material_kits')
    .update(kitData)
    .eq('id', kitId)

  if (errKit) {
    return { error: 'No se pudo actualizar el kit. Intenta de nuevo.' }
  }

  // Reemplazar componentes del kit
  const { error: errDel } = await supabase
    .from('material_kit_items')
    .delete()
    .eq('kit_id', kitId)

  if (errDel) {
    return { error: 'No se pudieron actualizar los componentes del kit.' }
  }

  if (items.length > 0) {
    const { error: errItems } = await supabase
      .from('material_kit_items')
      .insert(
        items.map((it) => ({
          kit_id: kitId,
          material_id: it.material_id,
          cantidad: it.cantidad,
        }))
      )

    if (errItems) {
      return { error: 'No se pudieron guardar los nuevos componentes del kit.' }
    }
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
