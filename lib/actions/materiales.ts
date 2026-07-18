'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarCatalogo } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { validateMaterialInput } from '@/lib/validations/material'

export type ActionResult = { error: string | null; ok?: boolean }

export async function createMaterialAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarCatalogo(session.rol)) {
    return { error: 'No tienes permiso para crear materiales.' }
  }

  const parsed = validateMaterialInput({
    nombre_base: formData.get('nombre_base'),
    variante: formData.get('variante'),
    unidad_medida: formData.get('unidad_medida'),
    categoria: formData.get('categoria'),
    subcategoria: formData.get('subcategoria'),
    especificacion: formData.get('especificacion'),
    activo: true,
  })

  if (!parsed.ok) {
    return { error: parsed.error }
  }

  const supabase = createClient()
  const { error } = await supabase.from('catalogo_materiales').insert(parsed.data)

  if (error) {
    if (error.code === '23505') {
      return { error: 'Ya existe un material con ese nombre y variante.' }
    }
    return { error: 'No se pudo crear el material. Intenta de nuevo.' }
  }

  revalidatePath('/materiales')
  redirect('/materiales')
}

export async function updateMaterialAction(
  materialId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarCatalogo(session.rol)) {
    return { error: 'No tienes permiso para editar materiales.' }
  }

  const parsed = validateMaterialInput({
    nombre_base: formData.get('nombre_base'),
    variante: formData.get('variante'),
    unidad_medida: formData.get('unidad_medida'),
    categoria: formData.get('categoria'),
    subcategoria: formData.get('subcategoria'),
    especificacion: formData.get('especificacion'),
    activo: formData.get('activo') !== 'false',
  })

  if (!parsed.ok) {
    return { error: parsed.error }
  }

  const supabase = createClient()
  const { error } = await supabase
    .from('catalogo_materiales')
    .update(parsed.data)
    .eq('id', materialId)

  if (error) {
    if (error.code === '23505') {
      return { error: 'Ya existe un material con ese nombre y variante.' }
    }
    return { error: 'No se pudo actualizar el material. Intenta de nuevo.' }
  }

  revalidatePath('/materiales')
  revalidatePath(`/materiales/${materialId}`)
  redirect('/materiales')
}
