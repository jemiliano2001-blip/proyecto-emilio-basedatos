'use server'

import { revalidatePath } from 'next/cache'
import {
  rutaFacturaDeOrden,
  validarArchivoFactura,
  type PrepararFacturaInput,
  type PrepararFacturaResult,
} from '@/lib/adjuntos'
import { getSessionUsuario } from '@/lib/auth/session'
import { hrefFacturaOrden } from '@/lib/facturas-oc'
import { puedeAsignarProveedorOC, puedeGestionarFacturasOC } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { validateFacturaOrdenInput } from '@/lib/validations/factura_oc'

export type OrdenActionResult = { error: string | null; ok?: boolean }

/**
 * Asigna o actualiza el proveedor y/o el folio físico de una Orden de Compra.
 */
export async function asignarProveedorOrdenAction(
  ordenId: string,
  proveedorId: string,
  folioFisico?: string | null
): Promise<OrdenActionResult> {
  const session = await getSessionUsuario()
  if (!session || !puedeAsignarProveedorOC(session.rol)) {
    return { error: 'No tienes permiso para modificar la orden de compra.' }
  }

  const supabase = await createClient()

  if (proveedorId.trim().length === 0) {
    return { error: 'Selecciona un proveedor antes de guardar la orden de compra.' }
  }

  const updates: { proveedor_id: string; folio_fisico?: string | null } = {
    proveedor_id: proveedorId.trim(),
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
 * Paso 1: valida permiso, tipo y tamaño, y devuelve la ruta.
 * El navegador sube el archivo directo a Storage; aquí no viaja el binario.
 */
export async function prepararSubidaFacturaAction(
  input: PrepararFacturaInput
): Promise<PrepararFacturaResult> {
  const session = await getSessionUsuario()
  if (!session?.perfil || !puedeGestionarFacturasOC(session.rol)) {
    return { error: 'No tienes permiso para adjuntar facturas.' }
  }
  if (!input || typeof input.orden_id !== 'string' || typeof input.nombre !== 'string') {
    return { error: 'Datos de la factura inválidos.' }
  }

  const validacion = validarArchivoFactura({
    name: input.nombre,
    type: typeof input.tipo === 'string' ? input.tipo : '',
    size: Number(input.tamano),
  })
  if (!validacion.ok) return { error: validacion.error }

  const supabase = await createClient()
  const { data: orden, error: ordenError } = await supabase
    .from('ordenes_compra')
    .select('id')
    .eq('id', input.orden_id)
    .maybeSingle()
  if (ordenError) return { error: 'No se pudo verificar la orden de compra.' }
  if (!orden) return { error: 'No se encontró la orden de compra.' }

  const limpio = input.nombre.trim().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'archivo'
  const path = `ordenes/${input.orden_id}/facturas/${crypto.randomUUID()}-${limpio}`
  return { error: null, path, tipo: validacion.tipo }
}

/**
 * Paso 2: registra la fila con la ruta ya subida. No recibe el archivo.
 */
export async function registrarFacturaOrdenAction(
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
  if (!parsed.ok) return { error: parsed.error }

  const { orden_id, obra_id, folio_factura, monto_factura } = parsed.data
  const pathRaw = formData.get('archivo_path')
  const nombreRaw = formData.get('archivo_nombre')
  const tipoRaw = formData.get('archivo_tipo')
  const storagePath = typeof pathRaw === 'string' ? pathRaw.trim() : ''
  const archivoNombre = typeof nombreRaw === 'string' ? nombreRaw.trim() : ''
  const archivoTipo = typeof tipoRaw === 'string' ? tipoRaw : ''
  const tamano = Number(formData.get('tamano_bytes'))
  const validacion = validarArchivoFactura({
    name: archivoNombre,
    type: archivoTipo,
    size: tamano,
  })
  if (!validacion.ok) return { error: validacion.error }
  if (!rutaFacturaDeOrden(orden_id, storagePath)) {
    return { error: 'La ruta del archivo no corresponde a esta orden.' }
  }

  const supabase = await createClient()
  const { data: orden, error: ordenError } = await supabase
    .from('ordenes_compra')
    .select('id, obra_id')
    .eq('id', orden_id)
    .maybeSingle()
  if (ordenError) return { error: 'No se pudo verificar la orden de compra.' }
  if (!orden) return { error: 'No se encontró la orden de compra.' }
  if (orden.obra_id !== obra_id) {
    return { error: 'La orden no pertenece a ese proyecto.' }
  }

  // El bucket es privado. archivo_url guarda el enlace de la app, no una URL pública.
  // Las filas viejas siguen abriéndose por archivo_path en /api/ordenes/facturas/[id].
  const facturaId = crypto.randomUUID()
  const { data: facturaRow, error: dbError } = await supabase
    .from('orden_compra_facturas')
    .insert({
      id: facturaId,
      orden_id,
      obra_id,
      folio_factura,
      monto_factura,
      archivo_path: storagePath,
      archivo_url: hrefFacturaOrden(facturaId),
      archivo_nombre: archivoNombre,
      tamano_bytes: tamano,
      tipo_archivo: validacion.tipo,
      subido_por: session.perfil.id,
    })
    .select('id')
    .single()

  if (dbError || !facturaRow) {
    await supabase.storage.from('obra-documentos').remove([storagePath])
    return { error: `No se pudo registrar la factura: ${dbError?.message ?? 'error desconocido'}` }
  }

  const itemIds = formData
    .getAll('item_ids')
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter((id) => UUID_RE.test(id))

  if (itemIds.length > 0) {
    // Solo ítems de esta OC
    const { data: itemsOk } = await supabase
      .from('orden_compra_items')
      .select('id')
      .eq('orden_id', orden_id)
      .in('id', itemIds)

    const validIds = new Set((itemsOk ?? []).map((r) => r.id))
    const rows = itemIds
      .filter((id) => validIds.has(id))
      .map((orden_item_id) => ({
        factura_id: facturaRow.id,
        orden_item_id,
      }))

    if (rows.length > 0) {
      const { error: linkError } = await supabase
        .from('orden_compra_factura_items')
        .insert(rows)
      if (linkError) {
        revalidatePath(`/ordenes/${orden_id}`)
        revalidatePath('/ordenes')
        return {
          error: `Factura subida, pero no se ligaron materiales: ${linkError.message}. Recarga y evita subir el mismo archivo otra vez; la factura ya quedó registrada.`,
        }
      }
    }
  }

  revalidatePath(`/ordenes/${orden_id}`)
  revalidatePath('/ordenes')
  return { error: null, ok: true }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

  const supabase = await createClient()

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
