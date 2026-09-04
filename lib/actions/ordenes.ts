'use server'

import { revalidatePath } from 'next/cache'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeAsignarProveedorOC, puedeGestionarFacturasOC } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { detectTipoArchivo, validateFacturaOrdenInput } from '@/lib/validations/factura_oc'

export type OrdenActionResult = { error: string | null; ok?: boolean }

/**
 * Asigna o actualiza el proveedor y/o el folio físico de una Orden de Compra.
 */
export async function asignarProveedorOrdenAction(
  ordenId: string,
  proveedorId: string | null,
  folioFisico?: string | null
): Promise<OrdenActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeAsignarProveedorOC(session.rol)) {
    return { error: 'No tienes permiso para modificar la orden de compra.' }
  }

  const supabase = createClient()

  const updates: { proveedor_id?: string | null; folio_fisico?: string | null } = {}
  if (proveedorId !== undefined) {
    updates.proveedor_id = proveedorId && proveedorId.trim().length > 0 ? proveedorId.trim() : null
  }
  if (folioFisico !== undefined) {
    updates.folio_fisico = folioFisico && folioFisico.trim().length > 0 ? folioFisico.trim() : null
  }

  const { error } = await supabase
    .from('ordenes_compra')
    .update(updates)
    .eq('id', ordenId)

  if (error) {
    return { error: `No se pudo actualizar la orden de compra: ${error.message}` }
  }

  revalidatePath(`/ordenes/${ordenId}`)
  revalidatePath(`/ordenes/${ordenId}/formato`)
  revalidatePath('/ordenes')
  return { error: null, ok: true }
}

/**
 * Sube y registra una factura en PDF o imagen para una Orden de Compra.
 */
export async function subirFacturaOrdenAction(
  _prev: OrdenActionResult,
  formData: FormData
): Promise<OrdenActionResult> {
  const session = await getSessionUsuario()
  if (!session || !session.perfil || !puedeGestionarFacturasOC(session.rol)) {
    return { error: 'No tienes permiso para adjuntar facturas.' }
  }

  const parsed = validateFacturaOrdenInput({
    orden_id: formData.get('orden_id'),
    obra_id: formData.get('obra_id'),
    folio_factura: formData.get('folio_factura'),
    monto_factura: formData.get('monto_factura'),
  })

  if (!parsed.ok) {
    return { error: parsed.error }
  }

  const file = formData.get('archivo') as File | null
  if (!file || typeof file.size !== 'number' || file.size === 0) {
    return { error: 'Selecciona un archivo válido (PDF o imagen) para subir.' }
  }

  // Detectar tipo de archivo
  const tipoArchivo = detectTipoArchivo(file.name, file.type)
  if (tipoArchivo !== 'pdf' && tipoArchivo !== 'imagen' && tipoArchivo !== 'xml') {
    return { error: 'Solo se permiten archivos en formato PDF, imágenes (JPG, PNG) o XML.' }
  }

  // Limitar a 30MB
  const maxBytes = 30 * 1024 * 1024
  if (file.size > maxBytes) {
    return { error: 'El archivo supera el tamaño máximo permitido de 30 MB.' }
  }

  const supabase = createClient()
  const { orden_id, obra_id, folio_factura, monto_factura } = parsed.data
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `ordenes/${orden_id}/facturas/${crypto.randomUUID()}-${sanitizedFileName}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadError } = await supabase.storage
    .from('obra-documentos')
    .upload(storagePath, buffer, {
      contentType: file.type || 'application/octet-stream',
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

  const { error: dbError } = await supabase.from('orden_compra_facturas').insert({
    orden_id,
    obra_id,
    folio_factura,
    monto_factura,
    archivo_path: storagePath,
    archivo_url: archivoUrl,
    archivo_nombre: file.name,
    tamano_bytes: file.size,
    tipo_archivo: tipoArchivo,
    subido_por: session.perfil.id,
  })

  if (dbError) {
    // Si falla la BD, limpiar storage
    await supabase.storage.from('obra-documentos').remove([storagePath])
    return { error: `No se pudo registrar la factura: ${dbError.message}` }
  }

  revalidatePath(`/ordenes/${orden_id}`)
  revalidatePath('/ordenes')
  return { error: null, ok: true }
}

/**
 * Elimina una factura adjunta a una Orden de Compra.
 */
export async function eliminarFacturaOrdenAction(
  facturaId: string,
  ordenId: string
): Promise<OrdenActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarFacturasOC(session.rol)) {
    return { error: 'No tienes permiso para eliminar facturas.' }
  }

  const supabase = createClient()

  const { data: factura, error: fetchError } = await supabase
    .from('orden_compra_facturas')
    .select('id, archivo_path')
    .eq('id', facturaId)
    .single()

  if (fetchError || !factura) {
    return { error: 'Factura no encontrada.' }
  }

  const { error: dbError } = await supabase
    .from('orden_compra_facturas')
    .delete()
    .eq('id', facturaId)

  if (dbError) {
    return { error: `No se pudo eliminar el registro: ${dbError.message}` }
  }

  // Intentar eliminar del Storage
  if (factura.archivo_path) {
    await supabase.storage.from('obra-documentos').remove([factura.archivo_path])
  }

  revalidatePath(`/ordenes/${ordenId}`)
  revalidatePath('/ordenes')
  return { error: null, ok: true }
}
