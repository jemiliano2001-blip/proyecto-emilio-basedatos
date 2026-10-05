import type { EstadoSolicitud } from '@/lib/types'

export type EtapaAprobacion = 'compras' | 'finanzas'

export function etapaAprobacionLote(
  estados: EstadoSolicitud[], puedeCompras: boolean, puedePago: boolean
): EtapaAprobacion | null {
  if (estados.length === 0) return null
  if (puedeCompras && estados.every(estado => estado === 'recibida')) return 'compras'
  if (puedePago && estados.every(estado => estado === 'en_proceso')) return 'finanzas'
  return null
}
