'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarCatalogo } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { validateMaterialInput } from '@/lib/validations/material'

export type ActionResult = { error: string | null; ok?: boolean }

async function uploadMaterialFoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  file: File | null
): Promise<{ url?: string; error?: string }> {
  if (!file || file.size === 0) return {}

  if (!file.type.startsWith('image/')) {
    return { error: 'El archivo adjunto debe ser una imagen válida (JPG, PNG, WebP, etc.).' }
  }

  // Límite de 10 MB para imágenes
  if (file.size > 10 * 1024 * 1024) {
    return { error: 'La imagen excede el límite máximo de 10 MB.' }
  }

  const sanitizedName = file.name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 40)
  const storagePath = `materiales/${crypto.randomUUID()}-${sanitizedName}`

  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('materiales')
    .upload(storagePath, buffer, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    })

  if (uploadError) {
    return { error: `Error al subir la imagen al almacenamiento: ${uploadError.message}` }
  }

  const { data: publicData } = supabase.storage
    .from('materiales')
    .getPublicUrl(storagePath)

  return { url: publicData.publicUrl }
}

export async function createMaterialAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarCatalogo(session.rol)) {
    return { error: 'No tienes permiso para crear materiales.' }
  }

  const supabase = await createClient()

  const fotoFile = formData.get('foto') as File | null
  let foto_url: string | null = null

  if (fotoFile && fotoFile.size > 0) {
    const uploadRes = await uploadMaterialFoto(supabase, fotoFile)
    if (uploadRes.error) {
      return { error: uploadRes.error }
    }
    foto_url = uploadRes.url ?? null
  }

  const parsed = validateMaterialInput({
    nombre_base: formData.get('nombre_base'),
    variante: formData.get('variante'),
    unidad_medida: formData.get('unidad_medida'),
    categoria: formData.get('categoria'),
    subcategoria: formData.get('subcategoria'),
    especificacion: formData.get('especificacion'),
    precio_base: formData.get('precio_base'),
    foto_url,
    activo: formData.get('activo') !== 'false',
  })

  if (!parsed.ok) {
    return { error: parsed.error }
  }

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

  const supabase = await createClient()

  const fotoFile = formData.get('foto') as File | null
  const fotoExistenteRaw = formData.get('foto_url_existente')
  let foto_url: string | null =
    typeof fotoExistenteRaw === 'string' && fotoExistenteRaw.trim() !== ''
      ? fotoExistenteRaw.trim()
      : null

  if (fotoFile && fotoFile.size > 0) {
    const uploadRes = await uploadMaterialFoto(supabase, fotoFile)
    if (uploadRes.error) {
      return { error: uploadRes.error }
    }
    if (uploadRes.url) {
      foto_url = uploadRes.url
    }
  }

  const parsed = validateMaterialInput({
    nombre_base: formData.get('nombre_base'),
    variante: formData.get('variante'),
    unidad_medida: formData.get('unidad_medida'),
    categoria: formData.get('categoria'),
    subcategoria: formData.get('subcategoria'),
    especificacion: formData.get('especificacion'),
    precio_base: formData.get('precio_base'),
    foto_url,
    activo: formData.get('activo') !== 'false',
  })

  if (!parsed.ok) {
    return { error: parsed.error }
  }

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
