'use server'

import { revalidatePath } from 'next/cache'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeEliminarDocumentos, puedeGestionarDocumentos } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { validateObraDocumentoInput } from '@/lib/validations/documento'

export type DocumentoActionResult = { error: string | null; ok?: boolean }

export async function uploadObraDocumentoAction(
  _prev: DocumentoActionResult,
  formData: FormData
): Promise<DocumentoActionResult> {
  const session = await getSessionUsuario()
  if (!session || !session.perfil || !puedeGestionarDocumentos(session.rol)) {
    return { error: 'No tienes permiso para subir documentación.' }
  }

  const parsed = validateObraDocumentoInput({
    obra_id: formData.get('obra_id'),
    nombre: formData.get('nombre'),
    tipo_documento: formData.get('tipo_documento'),
  })

  if (!parsed.ok) {
    return { error: parsed.error }
  }

  const file = formData.get('archivo') as File | null
  if (!file || typeof file.size !== 'number' || file.size === 0) {
    return { error: 'Selecciona un archivo PDF válido para subir.' }
  }

  // Validar formato PDF
  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!isPdf) {
    return { error: 'Solo se permiten archivos en formato PDF.' }
  }

  // Limitar a 30MB
  const maxBytes = 30 * 1024 * 1024
  if (file.size > maxBytes) {
    return { error: 'El archivo supera el tamaño máximo permitido de 30 MB.' }
  }

  const supabase = createClient()
  const obraId = parsed.data.obra_id
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `obras/${obraId}/${crypto.randomUUID()}-${sanitizedFileName}`

  // Convert File to ArrayBuffer
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadError } = await supabase.storage
    .from('obra-documentos')
    .upload(storagePath, buffer, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (uploadError) {
    return {
      error: `No se pudo guardar el archivo en Storage: ${uploadError.message}`,
    }
  }

  const { data: publicUrlData } = supabase.storage
    .from('obra-documentos')
    .getPublicUrl(storagePath)

  const archivoUrl = publicUrlData?.publicUrl || storagePath

  const { error: dbError } = await supabase.from('obra_documentos').insert({
    obra_id: obraId,
    nombre: parsed.data.nombre,
    tipo_documento: parsed.data.tipo_documento,
    archivo_path: storagePath,
    archivo_url: archivoUrl,
    tamano_bytes: file.size,
    subido_por: session.perfil.id,
  })

  if (dbError) {
    // Si falla la BD, limpiar storage
    await supabase.storage.from('obra-documentos').remove([storagePath])
    return { error: 'No se pudo registrar el documento en el proyecto. Intenta de nuevo.' }
  }

  revalidatePath(`/obras/${obraId}`)
  return { error: null, ok: true }
}

export async function deleteObraDocumentoAction(
  documentoId: string,
  obraId: string
): Promise<DocumentoActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeEliminarDocumentos(session.rol)) {
    return { error: 'No tienes permiso para eliminar documentos.' }
  }

  const supabase = createClient()

  const { data: doc, error: fetchError } = await supabase
    .from('obra_documentos')
    .select('id, archivo_path, obra_id')
    .eq('id', documentoId)
    .maybeSingle()

  if (fetchError || !doc) {
    return { error: 'El documento no existe o ya fue eliminado.' }
  }

  if (doc.obra_id !== obraId) {
    return { error: 'El documento no pertenece a este proyecto.' }
  }

  if (doc.archivo_path) {
    await supabase.storage.from('obra-documentos').remove([doc.archivo_path])
  }

  const { error: deleteError } = await supabase
    .from('obra_documentos')
    .delete()
    .eq('id', documentoId)

  if (deleteError) {
    return { error: 'No se pudo eliminar el documento de la base de datos.' }
  }

  revalidatePath(`/obras/${obraId}`)
  return { error: null, ok: true }
}
