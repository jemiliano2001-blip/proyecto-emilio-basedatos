/** Etiquetas legibles para tablas y acciones de la bitácora. */

const TABLAS: Record<string, string> = {
  usuarios: 'Usuarios',
  obras: 'Proyectos',
  obra_material_contratado: 'Topes de material',
  catalogo_materiales: 'Catálogo de materiales',
  catalogo_materiales_alias: 'Alias de materiales',
  solicitudes_material: 'Solicitudes',
  solicitud_items: 'Renglones de solicitud',
  solicitud_reservas_cantidad: 'Reservas de cantidad',
  proveedores: 'Proveedores',
  cotizaciones: 'Cotizaciones',
  cotizacion_items: 'Renglones de cotización',
  ordenes_compra: 'Órdenes de compra',
  orden_compra_items: 'Renglones de OC',
  orden_compra_facturas: 'Facturas de OC',
  orden_compra_factura_items: 'Renglones de factura OC',
  recepciones_material: 'Recepciones',
  recepcion_items: 'Renglones de recepción',
  recepcion_fotos: 'Fotos de recepción',
  obra_presupuesto_movimientos: 'Movimientos de presupuesto',
  traspasos_obra: 'Traspasos',
  traspaso_items: 'Renglones de traspaso',
  material_kits: 'Kits',
  material_kit_items: 'Renglones de kit',
  obra_documentos: 'Documentos de proyecto',
  material_categorias: 'Categorías',
  material_subcategorias: 'Subcategorías',
  obra_material_instalaciones: 'Instalaciones en obra',
}

const ACCIONES: Record<string, string> = {
  INSERT: 'Crear',
  UPDATE: 'Editar',
  DELETE: 'Borrar',
}

export function etiquetaTablaAuditoria(tabla: string): string {
  return TABLAS[tabla] ?? tabla.replaceAll('_', ' ')
}

export function etiquetaAccionAuditoria(accion: string): string {
  return ACCIONES[accion] ?? accion
}

export const ACCIONES_BITACORA = ['INSERT', 'UPDATE', 'DELETE'] as const
