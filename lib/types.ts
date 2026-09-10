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
  ciudad?: string | null
  fraccionamiento: string | null
  paquete: string | null
  ubicacion: string | null
  estado: 'activa' | 'pausada' | 'cerrada'
  presupuesto_mxn: number
  foto_url?: string | null
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
  precio_base?: number
  foto_url: string | null
  activo: boolean
}

export interface MaterialSubcategoria {
  id: string
  categoria_id: string
  nombre: string
  orden: number
  creado_en: string
}

export interface MaterialCategoria {
  id: string
  nombre: string
  orden: number
  creado_en: string
  material_subcategorias?: MaterialSubcategoria[]
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
  // Nuevas columnas del flujo acordado
  cantidad_asignada?: number
  cantidad_en_proceso?: number
  cantidad_comprada?: number
  cantidad_entregada?: number
  cantidad_disponible: number
  // Campos de compatibilidad
  cantidad_contratada: number
  cantidad_usada: number
  cantidad_comprometida?: number
  // Rubro y foto
  categoria?: string | null
  subcategoria?: string | null
  foto_url?: string | null
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

export type TipoFotoEvidencia =
  | 'remision_documento'
  | 'material_completo'
  | 'etiqueta_placa'
  | 'dano_evidencia'
  | 'firma_chofer'
  | 'selfie_entrega'

export interface RecepcionFoto {
  id: string
  recepcion_id: string
  recepcion_item_id?: string | null
  material_id?: string | null
  tipo_foto: TipoFotoEvidencia
  storage_path?: string
  foto_url: string
  capturado_por?: string
  capturado_en?: string
  latitud?: number | null
  longitud?: number | null
  precision_gps_m?: number | null
  resolucion_px?: string | null
  tamano_bytes?: number | null
  calidad_score?: number | null
  notas?: string | null
}

export interface RecepcionMaterial {
  id: string
  orden_id: string
  receptor_id: string
  estado: EstadoRecepcion
  referencia_entrega: string | null
  nota: string | null
  foto_remision_url?: string | null
  foto_evidencia_url?: string | null
  recibido_en: string
  revisado_por: string | null
  revisado_en: string | null
  nota_revision: string | null
  creado_en: string
  fotos?: RecepcionFoto[]
}

export interface RecepcionItem {
  id: string
  recepcion_id: string
  orden_item_id: string
  cantidad_recibida: number
  cantidad_danada: number
  estado: EstadoRecepcionItem
  observacion: string | null
  foto_url?: string | null
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

export interface Notificacion {
  id: string
  usuario_id: string | null
  rol_destino: RolUsuario | null
  titulo: string
  mensaje: string
  tipo: string
  referencia_id: string | null
  leida: boolean
  creado_en: string
}

export interface MaterialKit {
  id: string
  nombre: string
  material_principal_id: string | null
  configuracion: string | null
  descripcion: string | null
  activo: boolean
  creado_en: string
}

export interface MaterialKitItem {
  id: string
  kit_id: string
  material_id: string
  cantidad: number
  creado_en: string
  // Joins opcionales
  nombre_base?: string
  variante?: string | null
  unidad_medida?: string
  precio_base?: number
}

export interface MaterialKitWithItems extends MaterialKit {
  material_principal?: CatalogoMaterial | null
  items: (MaterialKitItem & {
    material?: CatalogoMaterial
  })[]
}

export type TipoDocumentoObra =
  | 'presupuesto'
  | 'conciliacion'
  | 'plano'
  | 'minuta'
  | 'general'
  | 'otro'

export interface ObraDocumento {
  id: string
  obra_id: string
  nombre: string
  tipo_documento: TipoDocumentoObra
  archivo_path: string
  archivo_url: string
  tamano_bytes: number | null
  subido_por: string | null
  creado_en: string
  subido_por_nombre?: string | null
}

export type TipoArchivoFactura = 'pdf' | 'imagen' | 'xml' | 'otro'

export interface OrdenCompraFactura {
  id: string
  orden_id: string
  obra_id: string
  folio_factura: string | null
  monto_factura: number | null
  archivo_path: string
  archivo_url: string
  archivo_nombre: string
  tamano_bytes: number | null
  tipo_archivo: TipoArchivoFactura
  subido_por: string | null
  creado_en: string
  subido_por_nombre?: string | null
}


