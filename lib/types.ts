export type RolUsuario =
  | 'personal'
  | 'compras'
  | 'proyectos'
  | 'operacion'
  | 'finanzas'
  | 'acceso_total'

export interface Usuario {
  id: string
  nombre: string
  rol: RolUsuario
  activo: boolean
}

export interface Obra {
  id: string
  nombre: string
  cliente: string | null
  fraccionamiento: string | null
  paquete: string | null
  ubicacion: string | null
  estado: 'activa' | 'pausada' | 'cerrada'
  presupuesto_mxn: number
  creado_en: string
}

export type CategoriaMaterialNombre = 'Obra Civil' | 'Electromecánico'

export interface CatalogoMaterial {
  id: string
  nombre_base: string
  variante: string | null
  unidad_medida: string
  categoria: string | null
  subcategoria: string | null
  especificacion: string | null
  foto_url: string | null
  activo: boolean
}

export interface ObraMaterialContratado {
  id: string
  obra_id: string
  material_id: string
  cantidad_contratada: number
}

export interface SaldoMaterialObra {
  obra_id: string
  material_id: string
  nombre_base: string
  variante: string | null
  unidad_medida: string
  cantidad_contratada: number
  cantidad_usada: number
  cantidad_comprometida?: number
  cantidad_disponible: number
}

export interface SaldoPresupuestoObra {
  obra_id: string
  presupuesto_mxn: number
  comprometido_mxn: number
  /** Incluye el neto de traspasos completados: gasto directo + cargo − crédito. */
  gastado_mxn: number
  disponible_mxn: number
  /** Lo que esta obra recuperó al ceder material por traspaso (Fase 6). */
  traspasos_credito_mxn?: number
  /** Lo que esta obra absorbió al recibir material por traspaso (Fase 6). */
  traspasos_cargo_mxn?: number
}

export type EstadoSolicitud =
  | 'recibida'
  | 'en_proceso'
  | 'finalizada'
  | 'cancelada'
  | 'rechazada'
  // Legacy (migrados; pueden aparecer en datos viejos sin remap)
  | 'pendiente'
  | 'en_cotizacion'
  | 'aprobada'

export type TipoLineaSolicitud =
  | 'material'
  | 'flete'
  | 'camiones'
  | 'mantenimiento'
  | 'otro'

export interface SolicitudMaterial {
  id: string
  obra_id: string
  solicitante_id: string
  estado: EstadoSolicitud
  nota: string | null
  creado_en: string
  cancelado_en: string | null
}

export interface SolicitudItem {
  id: string
  solicitud_id: string
  tipo_linea: TipoLineaSolicitud
  material_id: string | null
  cantidad_solicitada: number | null
  descripcion: string | null
  monto_mxn: number | null
  nota: string | null
  obra_id: string | null
}

export type EstadoCotizacion = 'borrador' | 'enviada' | 'aprobada' | 'rechazada'
export type EstadoOrdenCompra =
  | 'emitida'
  | 'cancelada'
  | 'parcialmente_recibida'
  | 'recibida'
export type MonedaOc = 'MXN' | 'USD'

export type EstadoRecepcion = 'pendiente_revision' | 'aprobada' | 'rechazada'
export type EstadoRecepcionItem = 'completo' | 'parcial' | 'faltante' | 'danado'

export interface RecepcionMaterial {
  id: string
  orden_id: string
  receptor_id: string
  estado: EstadoRecepcion
  referencia_entrega: string | null
  nota: string | null
  recibido_en: string
  revisado_por: string | null
  revisado_en: string | null
  nota_revision: string | null
  creado_en: string
}

export interface RecepcionItem {
  id: string
  recepcion_id: string
  orden_item_id: string
  cantidad_recibida: number
  cantidad_danada: number
  estado: EstadoRecepcionItem
  observacion: string | null
}

export interface OrdenChecklistResumen {
  id: string
  folio: string
  obra_id: string
  obra_nombre: string
  proveedor_nombre: string
  estado: EstadoOrdenCompra
  creado_en: string
}

export interface OrdenItemChecklist {
  orden_item_id: string
  material_id: string
  nombre_base: string
  variante: string | null
  unidad_medida: string
  cantidad_pedida: number
  cantidad_recibida_buena: number
  cantidad_danada_acum: number
  pendiente: number
  folio: string
  obra_id: string
  obra_nombre: string
  proveedor_nombre: string
  orden_estado: EstadoOrdenCompra
}

export interface Proveedor {
  id: string
  nombre: string
  contacto: string | null
  telefono: string | null
  activo: boolean
  creado_en: string
}

export interface Cotizacion {
  id: string
  solicitud_id: string
  cotizador_id: string
  estado: EstadoCotizacion
  nota: string | null
  creado_en: string
  actualizado_en: string
}

export interface CotizacionItem {
  id: string
  cotizacion_id: string
  solicitud_item_id: string
  proveedor_id: string
  precio_unitario: number
  cantidad: number
  moneda: MonedaOc
}

export interface OrdenCompra {
  id: string
  folio: string
  cotizacion_id: string | null
  solicitud_id: string | null
  proveedor_id: string | null
  obra_id: string
  estado: EstadoOrdenCompra
  total: number
  moneda: MonedaOc
  creado_por: string
  creado_en: string
}

export interface OrdenCompraItem {
  id: string
  orden_id: string
  material_id: string | null
  cantidad: number
  precio_unitario: number
  subtotal: number
  cotizacion_item_id: string | null
  descripcion: string | null
  tipo_linea: TipoLineaSolicitud
}

export type EstadoTraspaso =
  | 'solicitado'
  | 'en_transito'
  | 'completado'
  | 'rechazado'
  | 'cancelado'

export interface TraspasoObra {
  id: string
  folio: string
  obra_origen_id: string
  obra_destino_id: string
  solicitante_id: string
  aprobador_id: string | null
  receptor_id: string | null
  estado: EstadoTraspaso
  motivo: string | null
  creado_en: string
  aprobado_en: string | null
  recibido_en: string | null
  // Joins opcionales para UI
  obra_origen_nombre?: string
  obra_destino_nombre?: string
  solicitante_nombre?: string
}

export interface TraspasoItem {
  id: string
  traspaso_id: string
  material_id: string
  cantidad: number
  /** Congelado por `aprobar_traspaso`. Null mientras sigue en 'solicitado'. */
  precio_unitario_mxn: number | null
  creado_en: string
  // Joins opcionales para UI
  nombre_base?: string
  variante?: string | null
  unidad_medida?: string
}

/** Vista `v_conciliacion_obra_presupuesto` (Fase 7) — todo en MXN. */
export interface ConciliacionPresupuestoObra {
  obra_id: string
  obra_nombre: string
  cliente: string | null
  fraccionamiento: string | null
  paquete: string | null
  estado: Obra['estado']
  presupuesto_mxn: number
  creado_en: string
  cerrado_en: string | null
  cierre_nota: string | null
  reservado_requisiciones_mxn: number
  gastado_ordenes_compra_mxn: number
  fletes_camiones_mxn: number
  servicios_otros_mxn: number
  traspasos_credito_mxn: number
  traspasos_cargo_mxn: number
  gastado_total_ejecutado_mxn: number
  variacion_saldo_mxn: number
}

/** Vista `v_conciliacion_obra_material` (Fase 7) — cantidades físicas. */
export interface ConciliacionMaterialObra {
  obra_id: string
  material_id: string
  nombre_base: string
  variante: string | null
  unidad_medida: string
  categoria: string | null
  subcategoria: string | null
  cantidad_contratada: number
  traspasos_entrada: number
  traspasos_salida: number
  cantidad_tope_efectiva: number
  cantidad_usada: number
  cantidad_comprometida: number
  cantidad_disponible: number
  cantidad_recibida_buena_sitio: number
  porcentaje_ejecucion: number
}

