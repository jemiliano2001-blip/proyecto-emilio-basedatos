import type { RolUsuario } from '@/lib/types'

export function puedeGestionarObras(rol: RolUsuario | null): boolean {
  return rol === 'acceso_total' || rol === 'operacion'
}

export function puedeGestionarCatalogo(rol: RolUsuario | null): boolean {
  return rol === 'acceso_total' || rol === 'proyectos'
}

export function puedeGestionarKits(rol: RolUsuario | null): boolean {
  return rol === 'acceso_total' || rol === 'proyectos' || rol === 'operacion'
}

export function puedeGestionarTopes(rol: RolUsuario | null): boolean {
  return rol === 'acceso_total' || rol === 'operacion' || rol === 'proyectos'
}

export function puedeCrearSolicitudes(rol: RolUsuario | null): boolean {
  return rol === 'acceso_total' || rol === 'personal' || rol === 'compras'
}

export function puedeCrearSolicitudMultiObra(rol: RolUsuario | null): boolean {
  return rol === 'acceso_total' || rol === 'compras'
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

export function puedeSolicitarTraspaso(rol: RolUsuario | null): boolean {
  return (
    rol === 'acceso_total' ||
    rol === 'personal' ||
    rol === 'proyectos' ||
    rol === 'operacion' ||
    rol === 'compras'
  )
}

/** Quien puede entrar a /traspasos (solicitar, aprobar, confirmar o cancelar). */
export function puedeVerTraspasos(rol: RolUsuario | null): boolean {
  return (
    puedeSolicitarTraspaso(rol) ||
    puedeAprobarTraspaso(rol) ||
    puedeConfirmarTraspaso(rol) ||
    puedeCancelarTraspaso(rol)
  )
}

/**
 * Ojo: la RPC `cancelar_traspaso` acepta al solicitante (sea cual sea su rol)
 * O a estos dos. Este predicado cubre solo la segunda mitad; el "soy el
 * solicitante" se resuelve por separado con el id de sesión.
 */
export function puedeCancelarTraspaso(rol: RolUsuario | null): boolean {
  return rol === 'acceso_total' || rol === 'proyectos'
}

export function puedeAprobarTraspaso(rol: RolUsuario | null): boolean {
  return (
    rol === 'acceso_total' ||
    rol === 'proyectos' ||
    rol === 'operacion' ||
    rol === 'compras'
  )
}

export function puedeConfirmarTraspaso(rol: RolUsuario | null): boolean {
  return (
    rol === 'acceso_total' ||
    rol === 'personal' ||
    rol === 'proyectos' ||
    rol === 'operacion' ||
    rol === 'compras'
  )
}

export function puedeCerrarObra(rol: RolUsuario | null): boolean {
  return rol === 'acceso_total' || rol === 'operacion'
}

export function puedeReabrirObra(rol: RolUsuario | null): boolean {
  return rol === 'acceso_total'
}

export function puedeGestionarDocumentos(rol: RolUsuario | null): boolean {
  return (
    rol === 'acceso_total' ||
    rol === 'operacion' ||
    rol === 'proyectos' ||
    rol === 'compras' ||
    rol === 'finanzas'
  )
}

export function puedeEliminarDocumentos(rol: RolUsuario | null): boolean {
  return rol === 'acceso_total' || rol === 'operacion' || rol === 'proyectos'
}

export function puedeGestionarFacturasOC(rol: RolUsuario | null): boolean {
  return rol === 'acceso_total' || rol === 'compras' || rol === 'finanzas'
}

export function puedeAsignarProveedorOC(rol: RolUsuario | null): boolean {
  return rol === 'acceso_total' || rol === 'compras' || rol === 'finanzas'
}


