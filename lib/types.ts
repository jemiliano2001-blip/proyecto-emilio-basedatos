export type RolUsuario = 'personal' | 'compras' | 'proyectos' | 'operacion' | 'acceso_total'

export interface Usuario {
  id: string
  nombre: string
  rol: RolUsuario
  activo: boolean
}

export interface Obra {
  id: string
  nombre: string
  fraccionamiento: string | null
  paquete: string | null
  ubicacion: string | null
  estado: 'activa' | 'pausada' | 'cerrada'
  creado_en: string
}

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
  cantidad_disponible: number
}

export type EstadoSolicitud =
  | 'pendiente'
  | 'cancelada'
  | 'en_cotizacion'
  | 'aprobada'
  | 'rechazada'

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
  material_id: string
  cantidad_solicitada: number
  nota: string | null
}

export type EstadoCotizacion = 'borrador' | 'enviada' | 'aprobada' | 'rechazada'
export type EstadoOrdenCompra = 'emitida' | 'cancelada'
export type MonedaOc = 'MXN' | 'USD'

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
  cotizacion_id: string
  proveedor_id: string
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
  material_id: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}
