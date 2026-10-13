/** Segundos de vida de la URL firmada. Igual que /api/documentos/[id]. */
export const FACTURA_SIGNED_URL_SECONDS = 60

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Enlace estable de ver/descargar. El bucket `obra-documentos` es privado:
 * esta ruta firma `archivo_path` al vuelo. No guarda una URL pública.
 */
export function hrefFacturaOrden(facturaId: string): string {
  return `/api/ordenes/facturas/${facturaId}`
}

export function esIdFacturaOrden(id: string): boolean {
  return UUID_RE.test(id)
}
