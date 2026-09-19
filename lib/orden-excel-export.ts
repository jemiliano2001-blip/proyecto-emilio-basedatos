import {
  exportarTablaExcelFormal,
  sanitizarNombreArchivo,
  type ColumnaExcelConfig,
  type MetadatoExcel,
} from './excel-export-base'
import { vibrarExito } from './haptics'

export interface ItemOrdenExcel {
  no: number
  material: string
  variante?: string | null
  unidad: string
  cantidad: number
  precioUnitario?: number | null
  subtotal?: number | null
}

export interface DatosOrdenExcel {
  folio: string
  folioFisico?: string | null
  obraNombre: string
  fraccionamiento?: string | null
  proveedorNombre: string
  proveedorTelefono?: string | null
  solicitanteNombre?: string | null
  autorizadoPor?: string | null
  fechaEmision?: string | null
  moneda: string
  total: number
  items: ItemOrdenExcel[]
}

/**
 * Genera y detona la descarga de una Orden de Compra en formato formal de Excel (.xlsx)
 * con membrete institucional Navy/Teal, formatos de moneda reales y fórmulas de sumatoria.
 */
export async function descargarOrdenCompraExcel(orden: DatosOrdenExcel): Promise<void> {
  const columnas: ColumnaExcelConfig[] = [
    { header: '#', width: 8, align: 'center' },
    { header: 'Material / Descripción', width: 38, align: 'left' },
    { header: 'Variante / Calibre', width: 22, align: 'left' },
    { header: 'U. Medida', width: 14, align: 'center' },
    { header: 'Cantidad', width: 16, align: 'right', numFmt: '#,##0.00' },
    { header: 'Precio Unitario', width: 18, align: 'right', numFmt: '$#,##0.00' },
    { header: 'Importe Subtotal', width: 20, align: 'right', numFmt: '$#,##0.00' },
  ]

  const filas = orden.items.map((it) => [
    it.no,
    it.material,
    it.variante ?? '—',
    it.unidad,
    it.cantidad,
    it.precioUnitario ?? 0,
    it.subtotal ?? (it.cantidad * (it.precioUnitario ?? 0)),
  ])

  const metadatos: MetadatoExcel[] = [
    { label: 'Folio de Orden', value: orden.folio },
    ...(orden.folioFisico ? [{ label: 'Folio Físico', value: orden.folioFisico }] : []),
    { label: 'Proyecto / Obra', value: orden.obraNombre },
    ...(orden.fraccionamiento ? [{ label: 'Fraccionamiento', value: orden.fraccionamiento }] : []),
    { label: 'Proveedor', value: orden.proveedorNombre },
    ...(orden.proveedorTelefono ? [{ label: 'Teléfono Contacto', value: orden.proveedorTelefono }] : []),
    ...(orden.solicitanteNombre ? [{ label: 'Solicitado por', value: orden.solicitanteNombre }] : []),
    ...(orden.autorizadoPor ? [{ label: 'Autorizado por', value: orden.autorizadoPor }] : []),
    { label: 'Fecha de Emisión', value: orden.fechaEmision || new Date().toISOString().slice(0, 10) },
    { label: 'Moneda', value: orden.moneda || 'MXN' },
  ]

  const nombreArchivo = sanitizarNombreArchivo(
    `OC_${orden.folio}_${orden.proveedorNombre}_${orden.obraNombre}.xlsx`
  )

  await exportarTablaExcelFormal(
    {
      nombreHoja: `OC ${orden.folio}`.slice(0, 31),
      titulo: `ORDEN DE COMPRA — ${orden.folio}`,
      subtitulo: `Proveedor: ${orden.proveedorNombre}  ·  Obra: ${orden.obraNombre}`,
      metadatos,
      columnas,
      filas,
      totales: {
        labelColSpan: 6,
        label: 'TOTAL PACTADO ORDEN DE COMPRA',
        valores: [
          {
            colIndex: 7,
            valor: orden.total,
            numFmt: '$#,##0.00',
            align: 'right',
          },
        ],
      },
      orientacion: 'portrait',
    },
    nombreArchivo
  )

  vibrarExito()
}
