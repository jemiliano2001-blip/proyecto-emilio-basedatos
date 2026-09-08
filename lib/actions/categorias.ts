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

  // Obtener nombre actual para sincronizar materiales
  const { data: catActual } = await supabase
    .from('material_categorias')
    .select('nombre')
    .eq('id', categoriaId)
    .single()

  const { error } = await supabase
    .from('material_categorias')
    .update({ nombre: nuevoNombre })
    .eq('id', categoriaId)

  if (error) {
    if (error.code === '23505') {
      return { error: 'Ya existe otra categoría con ese nombre.' }
    }
    return { error: 'No se pudo actualizar la categoría.' }
  }

  // Si cambió el nombre, cascada a catalogo_materiales
  if (catActual && catActual.nombre !== nuevoNombre) {
    await supabase
      .from('catalogo_materiales')
      .update({ categoria: nuevoNombre })
      .eq('categoria', catActual.nombre)
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

  const { data: cat } = await supabase
    .from('material_categorias')
    .select('nombre')
    .eq('id', categoriaId)
    .single()

  if (!cat) {
    return { error: 'La categoría no existe.' }
  }

  // Reasignar materiales a Sin categoría para no perderlos
  await supabase
    .from('catalogo_materiales')
    .update({ categoria: null, subcategoria: null })
    .eq('categoria', cat.nombre)

  const { error } = await supabase
    .from('material_categorias')
    .delete()
    .eq('id', categoriaId)

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

  const { data: subActual } = await supabase
    .from('material_subcategorias')
    .select('nombre, categoria_id, material_categorias(nombre)')
    .eq('id', subcategoriaId)
    .single()

  const { error } = await supabase
    .from('material_subcategorias')
    .update({ nombre: nuevoNombre })
    .eq('id', subcategoriaId)

  if (error) {
    if (error.code === '23505') {
      return { error: 'Ya existe esa subcategoría dentro de esta categoría.' }
    }
    return { error: 'No se pudo actualizar la subcategoría.' }
  }

  // Cascada a catalogo_materiales
  const catObj = subActual?.material_categorias as { nombre?: string } | null
  const catNombre = catObj?.nombre
  if (subActual && subActual.nombre !== nuevoNombre && catNombre) {
    await supabase
      .from('catalogo_materiales')
      .update({ subcategoria: nuevoNombre })
      .eq('categoria', catNombre)
      .eq('subcategoria', subActual.nombre)
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

  const { data: subActual } = await supabase
    .from('material_subcategorias')
    .select('nombre, material_categorias(nombre)')
    .eq('id', subcategoriaId)
    .single()

  const catObj = subActual?.material_categorias as { nombre?: string } | null
  const catNombre = catObj?.nombre
  if (subActual && catNombre) {
    // Reasignar subcategoría a null para no perder los materiales
    await supabase
      .from('catalogo_materiales')
      .update({ subcategoria: null })
      .eq('categoria', catNombre)
      .eq('subcategoria', subActual.nombre)
  }

  const { error } = await supabase
    .from('material_subcategorias')
    .delete()
    .eq('id', subcategoriaId)

  if (error) {
    return { error: 'No se pudo eliminar la subcategoría.' }
  }

  revalidatePath('/materiales')
  return { error: null, ok: true }
}
