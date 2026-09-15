'use server'

/**
 * El circuito anterior podía emitir una OC sin la aprobación de Finanzas.
 * Conservamos estas acciones para clientes/versiones previas, pero siempre
 * detienen la operación y señalan el flujo vigente de requisiciones.
 */
export type ActionResult = { error: string | null; ok?: boolean }

const MENSAJE_FLUJO_RETIRADO =
  'El flujo anterior de cotización fue retirado. Continúa la requisición con Compras y Finanzas antes de emitir la orden de compra.'

export async function createCotizacionAction(
  _prev: ActionResult,
  _formData: FormData
): Promise<ActionResult> {
  return { error: MENSAJE_FLUJO_RETIRADO }
}

export async function aprobarCotizacionAction(
  _cotizacionId: string,
  _prev: ActionResult,
  _formData: FormData
): Promise<ActionResult> {
  return { error: MENSAJE_FLUJO_RETIRADO }
}

export async function rechazarCotizacionAction(
  _cotizacionId: string,
  _prev: ActionResult,
  _formData: FormData
): Promise<ActionResult> {
  return { error: MENSAJE_FLUJO_RETIRADO }
}
