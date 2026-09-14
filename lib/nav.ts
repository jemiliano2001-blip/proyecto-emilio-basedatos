export function tituloDeRuta(pathname: string): string {
  if (pathname.startsWith('/notificaciones')) return 'Avisos'
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
