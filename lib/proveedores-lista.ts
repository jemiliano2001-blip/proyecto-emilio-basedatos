import { normalizarTelefonoWhatsApp } from '@/lib/whatsapp-notificacion'
import { toFinite } from '@/lib/money'
import type { Proveedor } from '@/lib/types'

export type EstatusProveedor = 'todos' | 'activos'

export function enlaceLlamar(telefono: string | null | undefined): string | null {
  const numero = normalizarTelefonoWhatsApp(telefono)
  return numero ? `tel:+${numero}` : null
}

export function enlaceWhatsApp(telefono: string | null | undefined): string | null {
  const numero = normalizarTelefonoWhatsApp(telefono)
  return numero ? `https://wa.me/${numero}` : null
}

function plano(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function filtrarProveedores(
  lista: Proveedor[],
  q: string,
  estatus: EstatusProveedor
): Proveedor[] {
  const buscado = plano(q.trim())
  return lista.filter((p) => {
    if (estatus === 'activos' && !p.activo) return false
    if (!buscado) return true
    return plano([p.nombre, p.contacto ?? '', p.telefono ?? ''].join(' ')).includes(buscado)
  })
}

export interface OrdenHistorial {
  estado: string
  total: number | string
  creado_en: string
}

/** Las canceladas no son compra: no suman al total ni cuentan como última compra. */
export function resumirHistorial(ordenes: OrdenHistorial[]): {
  cantidad: number
  total: number
  ultima: string | null
} {
  let total = 0
  let cantidad = 0
  let ultima: string | null = null
  for (const orden of ordenes) {
    if (orden.estado === 'cancelada') continue
    cantidad += 1
    total += toFinite(orden.total)
    if (!ultima || orden.creado_en > ultima) ultima = orden.creado_en
  }
  return { cantidad, total: Math.round(total * 100) / 100, ultima }
}
