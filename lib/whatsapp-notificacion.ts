/**
 * Utilidades para generación de mensajes y enlaces directos de WhatsApp
 * para Órdenes de Compra, Requisiciones y Logística de Obra en Proyecto Emilio.
 */

export interface ItemOrdenWhatsApp {
  cantidad: number
  unidad: string
  descripcion: string
  precioUnitario?: number | null
  subtotal?: number | null
}

export interface DatosOrdenWhatsApp {
  folio: string
  folioFisico?: string | null
  obraNombre: string
  fraccionamiento?: string | null
  proveedorNombre: string
  proveedorTelefono?: string | null
  solicitanteNombre?: string | null
  autorizadoPor?: string | null
  fechaEmision?: string | null
  moneda?: string
  total?: number | null
  notas?: string | null
  items: ItemOrdenWhatsApp[]
}

/**
 * Normaliza un número telefónico para formato internacional de WhatsApp.
 * Maneja números mexicanos (10 dígitos -> 52XXXXXXXXXX, elimina prefijo 1 de 521).
 */
export function normalizarTelefonoWhatsApp(telefono: string | null | undefined): string | null {
  if (!telefono) return null
  const limpio = telefono.replace(/\D/g, '')
  if (!limpio) return null

  // 10 dígitos (México local, ej: 81 1234 5678)
  if (limpio.length === 10) {
    return `52${limpio}`
  }

  // 11 dígitos que inician con 1 (ej: 1 81 1234 5678)
  if (limpio.length === 11 && limpio.startsWith('1')) {
    return `52${limpio.slice(1)}`
  }

  // 13 dígitos 521XXXXXXXXXX (antiguo formato móvil mexicano) -> 52XXXXXXXXXX
  if (limpio.length === 13 && limpio.startsWith('521')) {
    return `52${limpio.slice(3)}`
  }

  // Ya tiene código de país (12 dígitos para México: 52 + 10 dígitos)
  if (limpio.length === 12 && limpio.startsWith('52')) {
    return limpio
  }

  // Internacional general (entre 10 y 15 dígitos)
  if (limpio.length >= 10 && limpio.length <= 15) {
    return limpio
  }

  return null
}

/**
 * Construye el mensaje estructurado de la Orden de Compra para WhatsApp.
 */
export function generarMensajeWhatsAppOrden(orden: DatosOrdenWhatsApp): string {
  const lineas: string[] = []

  const folioTexto = orden.folioFisico
    ? `${orden.folio} (Físico: ${orden.folioFisico})`
    : orden.folio

  lineas.push(`🏗️ *ORDEN DE COMPRA: ${folioTexto}*`)
  lineas.push(`📍 *Proyecto:* ${orden.obraNombre}${orden.fraccionamiento ? ` · ${orden.fraccionamiento}` : ''}`)
  lineas.push(`🏢 *Proveedor:* ${orden.proveedorNombre}`)

  if (orden.fechaEmision) {
    lineas.push(`📅 *Fecha:* ${orden.fechaEmision}`)
  }
  if (orden.solicitanteNombre) {
    lineas.push(`👷 *Solicitó:* ${orden.solicitanteNombre}`)
  }

  lineas.push('')
  lineas.push(`📋 *MATERIALES REQUERIDOS:*`)

  ;(orden.items ?? []).forEach((it, idx) => {
    const rawCant = typeof it.cantidad === 'number' && Number.isFinite(it.cantidad) ? it.cantidad : 0
    const cantFormateada = Number.isInteger(rawCant)
      ? String(rawCant)
      : rawCant.toFixed(2)
    const unidad = it.unidad ? it.unidad.trim() : 'PZA'
    const desc = it.descripcion ? it.descripcion.trim() : 'Material'
    lineas.push(`${idx + 1}. *${cantFormateada} ${unidad}* — ${desc}`)
  })

  if (typeof orden.total === 'number' && Number.isFinite(orden.total) && orden.total > 0) {
    const totalMx = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: orden.moneda || 'MXN',
    }).format(orden.total)
    lineas.push('')
    lineas.push(`💰 *Total pactado:* ${totalMx}`)
  }

  if (orden.autorizadoPor) {
    lineas.push(`✍️ *Autorizó:* ${orden.autorizadoPor}`)
  }

  if (orden.notas && orden.notas.trim()) {
    lineas.push('')
    lineas.push(`📝 *Nota de entrega:* ${orden.notas.trim()}`)
  }

  lineas.push('')
  lineas.push(`_Mensaje emitido desde el Sistema de Control — Proyecto Emilio_`)

  return lineas.join('\n')
}

/**
 * Genera la URL de WhatsApp (wa.me) lista para abrir en navegador o app móvil.
 */
export function generarUrlWhatsApp({
  telefono,
  mensaje,
}: {
  telefono?: string | null
  mensaje: string
}): string {
  const telNorm = normalizarTelefonoWhatsApp(telefono)
  const textoCodificado = encodeURIComponent(mensaje)
  if (telNorm) {
    return `https://wa.me/${telNorm}?text=${textoCodificado}`
  }
  return `https://api.whatsapp.com/send?text=${textoCodificado}`
}

/**
 * Copia un texto al portapapeles con manejo seguro de permisos.
 */
export async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return false
  }
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    return false
  }
}
