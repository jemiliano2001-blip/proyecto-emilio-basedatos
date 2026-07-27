import type { RolUsuario } from '@/lib/types'

export function puedeGestionarObras(rol: RolUsuario | null): boolean {
  return rol === 'acceso_total' || rol === 'operacion'
}

export function puedeGestionarCatalogo(rol: RolUsuario | null): boolean {
  return rol === 'acceso_total' || rol === 'proyectos'
}

export function puedeGestionarTopes(rol: RolUsuario | null): boolean {
  return rol === 'acceso_total' || rol === 'operacion' || rol === 'proyectos'
}

export function puedeCrearSolicitudes(rol: RolUsuario | null): boolean {
  return rol === 'acceso_total' || rol === 'personal'
}

export function puedeVerTodasLasSolicitudes(rol: RolUsuario | null): boolean {
  return (
    rol === 'acceso_total' ||
    rol === 'compras' ||
    rol === 'finanzas' ||
    rol === 'proyectos' ||
    rol === 'operacion'
  )
}

export function puedeAprobarCompras(rol: RolUsuario | null): boolean {
  return rol === 'acceso_total' || rol === 'compras'
}

export function puedeAprobarPago(rol: RolUsuario | null): boolean {
  return rol === 'acceso_total' || rol === 'finanzas'
}

/** @deprecated Prefer puedeAprobarCompras; se mantiene por pantallas legacy de cotización. */
export function puedeCotizar(rol: RolUsuario | null): boolean {
  return puedeAprobarCompras(rol)
}

export function puedeGestionarProveedores(rol: RolUsuario | null): boolean {
  return rol === 'acceso_total' || rol === 'compras'
}

export function puedeVerPrecios(rol: RolUsuario | null): boolean {
  return (
    rol === 'acceso_total' ||
    rol === 'compras' ||
    rol === 'finanzas' ||
    rol === 'operacion' ||
    rol === 'proyectos'
  )
}

export function puedeCapturarRecepcion(rol: RolUsuario | null): boolean {
  return rol === 'acceso_total' || rol === 'personal' || rol === 'compras'
}

export function puedeRevisarRecepcion(rol: RolUsuario | null): boolean {
  return rol === 'acceso_total' || rol === 'compras'
}

export function puedeVerRecepciones(rol: RolUsuario | null): boolean {
  return (
    rol === 'acceso_total' ||
    rol === 'personal' ||
    rol === 'compras' ||
    rol === 'finanzas' ||
    rol === 'operacion' ||
    rol === 'proyectos'
  )
}
