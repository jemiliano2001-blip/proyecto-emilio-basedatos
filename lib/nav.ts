import type { RolUsuario } from '@/lib/types'
import {
  esVistaCampoLimitada,
  puedeGestionarProveedores,
  puedeGestionarUsuarios,
  puedeVerBitacora,
  puedeVerInventarioCampo,
  puedeVerNavProyectos,
  puedeVerPrecios,
  puedeVerRecepciones,
  puedeVerTraspasos,
} from '@/lib/roles'

/**
 * Única fuente de verdad de la navegación. La consumen el sidebar (desktop),
 * la bottom nav + hoja "Más" (móvil), el TopBar y el command palette.
 * La visibilidad aquí es conveniencia de UI; la seguridad real vive en RLS.
 */

/** Cookie que persiste el estado del sidebar de escritorio ('1' = contraído). */
export const SIDEBAR_COOKIE = 'ot-sidebar'

export type NavItemId =
  | 'proyectos'
  | 'solicitudes'
  | 'recepciones'
  | 'inventario'
  | 'traspasos'
  | 'ordenes'
  | 'materiales'
  | 'kits'
  | 'proveedores'
  | 'usuarios'
  | 'bitacora'

export type NavSectionId = 'operacion' | 'compras' | 'admin'

export type NavIconId =
  | 'proyectos'
  | 'solicitudes'
  | 'recepcion'
  | 'paquete'
  | 'traspasos'
  | 'ordenes'
  | 'materiales'
  | 'rayo'
  | 'proveedores'
  | 'usuarios'
  | 'bitacora'

export interface NavContext {
  rol: RolUsuario | null
  traspasosDisponibles: boolean
}

export interface NavItem {
  id: NavItemId
  label: string
  /** Etiqueta corta para la bottom nav (≤ 11 caracteres). */
  shortLabel?: string
  href: string
  icon: NavIconId
  section: NavSectionId
  isActive: (pathname: string) => boolean
  visible: (ctx: NavContext) => boolean
  /** Si aparece como pestaña en la bottom nav móvil (máx. 4 + "Más"). */
  mobileTab: (ctx: NavContext) => boolean
}

export const NAV_SECTIONS: { id: NavSectionId; label: string }[] = [
  { id: 'operacion', label: 'Operación' },
  { id: 'compras', label: 'Compras y catálogo' },
  { id: 'admin', label: 'Administración' },
]

const startsWith = (prefix: string) => (pathname: string) => pathname.startsWith(prefix)

export const NAV_ITEMS: NavItem[] = [
  {
    id: 'proyectos',
    label: 'Proyectos',
    href: '/',
    icon: 'proyectos',
    section: 'operacion',
    isActive: (p) => p === '/' || p.startsWith('/obras'),
    visible: ({ rol }) => puedeVerNavProyectos(rol),
    mobileTab: ({ rol }) => puedeVerNavProyectos(rol),
  },
  {
    id: 'solicitudes',
    label: 'Solicitudes',
    href: '/solicitudes',
    icon: 'solicitudes',
    section: 'operacion',
    isActive: startsWith('/solicitudes'),
    visible: () => true,
    mobileTab: () => true,
  },
  {
    id: 'recepciones',
    label: 'Recepción',
    href: '/recepciones',
    icon: 'recepcion',
    section: 'operacion',
    isActive: (p) => p.startsWith('/recepciones') || p.includes('/recibir'),
    visible: ({ rol }) => puedeVerRecepciones(rol),
    mobileTab: ({ rol }) => puedeVerRecepciones(rol) && rol !== 'finanzas',
  },
  {
    id: 'inventario',
    label: 'Inventario en obra',
    shortLabel: 'Inventario',
    href: '/inventario',
    icon: 'paquete',
    section: 'operacion',
    isActive: startsWith('/inventario'),
    visible: ({ rol }) => puedeVerInventarioCampo(rol),
    mobileTab: ({ rol }) => esVistaCampoLimitada(rol) && puedeVerInventarioCampo(rol),
  },
  {
    id: 'traspasos',
    label: 'Traspasos',
    href: '/traspasos',
    icon: 'traspasos',
    section: 'operacion',
    isActive: startsWith('/traspasos'),
    visible: ({ rol, traspasosDisponibles }) =>
      traspasosDisponibles && puedeVerTraspasos(rol) && !esVistaCampoLimitada(rol),
    mobileTab: () => false,
  },
  {
    id: 'ordenes',
    label: 'Órdenes de compra',
    shortLabel: 'Órdenes',
    href: '/ordenes',
    icon: 'ordenes',
    section: 'compras',
    isActive: (p) => p.startsWith('/ordenes') && !p.includes('/recibir'),
    visible: ({ rol }) => puedeVerPrecios(rol),
    mobileTab: ({ rol }) => rol === 'finanzas' && puedeVerPrecios(rol),
  },
  {
    id: 'materiales',
    label: 'Catálogo de materiales',
    shortLabel: 'Catálogo',
    href: '/materiales',
    icon: 'materiales',
    section: 'compras',
    isActive: startsWith('/materiales'),
    visible: ({ rol }) => !esVistaCampoLimitada(rol),
    mobileTab: () => false,
  },
  {
    id: 'kits',
    label: 'Kits y ensambles',
    shortLabel: 'Kits',
    href: '/kits',
    icon: 'rayo',
    section: 'compras',
    isActive: startsWith('/kits'),
    visible: ({ rol }) => !esVistaCampoLimitada(rol),
    mobileTab: () => false,
  },
  {
    id: 'proveedores',
    label: 'Proveedores',
    href: '/proveedores',
    icon: 'proveedores',
    section: 'compras',
    isActive: startsWith('/proveedores'),
    visible: ({ rol }) => puedeGestionarProveedores(rol) && !esVistaCampoLimitada(rol),
    mobileTab: () => false,
  },
  {
    id: 'usuarios',
    label: 'Usuarios',
    href: '/usuarios',
    icon: 'usuarios',
    section: 'admin',
    isActive: startsWith('/usuarios'),
    visible: ({ rol }) => puedeGestionarUsuarios(rol),
    mobileTab: () => false,
  },
  {
    id: 'bitacora',
    label: 'Bitácora',
    href: '/bitacora',
    icon: 'bitacora',
    section: 'admin',
    isActive: startsWith('/bitacora'),
    visible: ({ rol }) => puedeVerBitacora(rol),
    mobileTab: () => false,
  },
]

export function navItemsVisibles(ctx: NavContext): NavItem[] {
  return NAV_ITEMS.filter((item) => item.visible(ctx))
}

/** Pestañas de la bottom nav móvil (sin contar "Más"). */
export function navTabsMovil(ctx: NavContext): NavItem[] {
  return navItemsVisibles(ctx).filter((item) => item.mobileTab(ctx)).slice(0, 4)
}

/** Lo que no cupo como pestaña se lista en la hoja "Más". */
export function navItemsEnMas(ctx: NavContext): NavItem[] {
  const tabs = new Set(navTabsMovil(ctx).map((t) => t.id))
  return navItemsVisibles(ctx).filter((item) => !tabs.has(item.id))
}

export function navItemActivo(pathname: string): NavItem | null {
  return NAV_ITEMS.find((item) => item.isActive(pathname)) ?? null
}

export function tituloDeRuta(pathname: string): string {
  if (pathname.startsWith('/notificaciones')) return 'Avisos'
  if (pathname.startsWith('/usuarios')) return 'Usuarios'
  if (pathname.startsWith('/bitacora')) return 'Bitácora'
  if (pathname.startsWith('/solicitudes')) return 'Solicitudes'
  if (pathname.startsWith('/recepciones') || pathname.includes('/recibir')) return 'Recepción'
  if (pathname.startsWith('/inventario')) return 'Inventario'
  if (pathname.startsWith('/traspasos')) return 'Traspasos'
  if (pathname.startsWith('/ordenes')) return 'Órdenes'
  if (pathname.startsWith('/kits')) return 'Kits y Ensambles'
  if (pathname.startsWith('/materiales')) return 'Materiales'
  if (pathname.startsWith('/proveedores')) return 'Proveedores'
  if (pathname.startsWith('/obras') || pathname === '/') return 'Proyectos'
  return 'ObraTrack'
}

/** Migas de pan a partir de la ruta. Solo etiquetas de sección; el detalle lo pone la página. */
export function migasDeRuta(pathname: string): { label: string; href: string }[] {
  const item = navItemActivo(pathname)
  const migas: { label: string; href: string }[] = []
  if (item) migas.push({ label: item.label, href: item.href })
  else if (pathname.startsWith('/notificaciones')) migas.push({ label: 'Avisos', href: '/notificaciones' })

  const segments = pathname.split('/').filter(Boolean)
  const last = segments[segments.length - 1]
  if (last === 'nueva' || last === 'nuevo') migas.push({ label: last === 'nueva' ? 'Nueva' : 'Nuevo', href: pathname })
  else if (last === 'editar') migas.push({ label: 'Editar', href: pathname })
  else if (last === 'cotizar') migas.push({ label: 'Cotizar', href: pathname })
  else if (last === 'formato') migas.push({ label: 'Formato', href: pathname })
  else if (last === 'recibir') migas.push({ label: 'Recibir', href: pathname })
  else if (last === 'revisar') migas.push({ label: 'Revisar', href: pathname })
  else if (last === 'conciliacion') migas.push({ label: 'Conciliación', href: pathname })
  else if (last === 'tope') migas.push({ label: 'Tope', href: pathname })
  else if (last === 'asignar-materiales') migas.push({ label: 'Asignar materiales', href: pathname })
  else if (segments.length >= 2 && item && segments[0] !== '' ) migas.push({ label: 'Detalle', href: pathname })
  return migas
}

export function hrefNotificacion(tipo: string, referenciaId: string | null): string | null {
  if (!referenciaId) return null
  if (tipo.startsWith('solicitud_')) return `/solicitudes/${referenciaId}`
  if (
    tipo === 'checklist_pendiente' ||
    tipo.startsWith('recepcion_') ||
    tipo === 'discrepancia_recepcion'
  ) {
    return `/recepciones/${referenciaId}`
  }
  if (tipo.startsWith('traspaso_')) return `/traspasos/${referenciaId}`
  if (tipo === 'obra_cerrada') return `/obras/${referenciaId}`
  return null
}
