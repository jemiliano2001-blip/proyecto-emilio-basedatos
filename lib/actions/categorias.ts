'use server'

import { revalidatePath } from 'next/cache'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarCatalogo } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'

export type ActionResult = { error: string | null; ok?: boolean }

export async function crearCategoriaAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarCatalogo(session.rol)) {
    return { error: 'No tienes permiso para gestionar categorías.' }
  }

  const nombreRaw = formData.get('nombre')
  const nombre = typeof nombreRaw === 'string' ? nombreRaw.trim() : ''

  if (!nombre) {
    return { error: 'El nombre de la categoría no puede estar vacío.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('material_categorias').insert({ nombre })

  if (error) {
    if (error.code === '23505') {
      return { error: 'Ya existe una categoría con ese nombre.' }
    }
    return { error: 'No se pudo crear la categoría. Intenta de nuevo.' }
  }

  revalidatePath('/materiales')
  return { error: null, ok: true }
}

export async function actualizarCategoriaAction(
  categoriaId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarCatalogo(session.rol)) {
    return { error: 'No tienes permiso para gestionar categorías.' }
  }

  const nombreRaw = formData.get('nombre')
  const nuevoNombre = typeof nombreRaw === 'string' ? nombreRaw.trim() : ''

  if (!nuevoNombre) {
    return { error: 'El nombre de la categoría no puede estar vacío.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('renombrar_categoria_material', {
    p_id: categoriaId,
    p_nombre: nuevoNombre,
  })

  if (error) {
    if (error.code === '23505') {
      return { error: 'Ya existe otra categoría con ese nombre.' }
    }
    return { error: 'No se pudo actualizar la categoría.' }
  }

  revalidatePath('/materiales')
  return { error: null, ok: true }
}

export async function eliminarCategoriaAction(
  categoriaId: string
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarCatalogo(session.rol)) {
    return { error: 'No tienes permiso para eliminar categorías.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('eliminar_categoria_material', { p_id: categoriaId })

  if (error) {
    return { error: 'No se pudo eliminar la categoría.' }
  }

  revalidatePath('/materiales')
  return { error: null, ok: true }
}

export async function crearSubcategoriaAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarCatalogo(session.rol)) {
    return { error: 'No tienes permiso para gestionar subcategorías.' }
  }

  const categoriaId = String(formData.get('categoria_id') ?? '').trim()
  const nombreRaw = formData.get('nombre')
  const nombre = typeof nombreRaw === 'string' ? nombreRaw.trim() : ''

  if (!categoriaId) {
    return { error: 'Debes seleccionar una categoría.' }
  }
  if (!nombre) {
    return { error: 'El nombre de la subcategoría no puede estar vacío.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('material_subcategorias')
    .insert({ categoria_id: categoriaId, nombre })

  if (error) {
    if (error.code === '23505') {
      return { error: 'Ya existe esa subcategoría dentro de esta categoría.' }
    }
    return { error: 'No se pudo crear la subcategoría.' }
  }

  revalidatePath('/materiales')
  return { error: null, ok: true }
}

export async function actualizarSubcategoriaAction(
  subcategoriaId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarCatalogo(session.rol)) {
    return { error: 'No tienes permiso para gestionar subcategorías.' }
  }

  const nombreRaw = formData.get('nombre')
  const nuevoNombre = typeof nombreRaw === 'string' ? nombreRaw.trim() : ''

  if (!nuevoNombre) {
    return { error: 'El nombre de la subcategoría no puede estar vacío.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('renombrar_subcategoria_material', {
    p_id: subcategoriaId,
    p_nombre: nuevoNombre,
  })

  if (error) {
    if (error.code === '23505') {
      return { error: 'Ya existe esa subcategoría dentro de esta categoría.' }
    }
    return { error: 'No se pudo actualizar la subcategoría.' }
  }

  revalidatePath('/materiales')
  return { error: null, ok: true }
}

export async function eliminarSubcategoriaAction(
  subcategoriaId: string
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarCatalogo(session.rol)) {
    return { error: 'No tienes permiso para eliminar subcategorías.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('eliminar_subcategoria_material', { p_id: subcategoriaId })

  if (error) {
    return { error: 'No se pudo eliminar la subcategoría.' }
  }

  revalidatePath('/materiales')
  return { error: null, ok: true }
}
