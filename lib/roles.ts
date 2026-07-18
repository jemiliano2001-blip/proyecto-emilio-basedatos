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
    rol === 'proyectos' ||
    rol === 'operacion'
  )
}

export function puedeCotizar(rol: RolUsuario | null): boolean {
  return rol === 'acceso_total' || rol === 'compras'
}

export function puedeGestionarProveedores(rol: RolUsuario | null): boolean {
  return rol === 'acceso_total' || rol === 'compras'
}

export function puedeVerPrecios(rol: RolUsuario | null): boolean {
  return (
    rol === 'acceso_total' ||
    rol === 'compras' ||
    rol === 'operacion' ||
    rol === 'proyectos'
  )
}
