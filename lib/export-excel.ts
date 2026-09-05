/**
 * Utilidad de exportación tabular compatible con Microsoft Excel (Windows / Mac)
 * Implementa BOM UTF-8 (\uFEFF) para garantizar la correcta visualización de
 * acentos, la letra 'ñ' y símbolos de moneda en Excel sin necesidad de asistentes de importación.
 */

export interface CsvColumn<T> {
  header: string
  accessor: (item: T) => string | number | null | undefined
}

export interface CsvExportOptions<T> {
  filename: string
  title?: string
  metadata?: { label: string; value: string | number }[]
  columns: CsvColumn<T>[]
  data: T[]
}

function escapeCsvCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""'
  const str = String(val)
  // Si contiene comillas, comas, saltos de línea o punto y coma, encerramos entre comillas dobles y escapamos
  if (/[",\n\r;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return `"${str}"`
}

/**
 * Genera el contenido CSV y detona la descarga en el navegador del usuario.
 */
export function exportToCsv<T>({
  filename,
  title,
  metadata = [],
  columns,
  data,
}: CsvExportOptions<T>): void {
  const lines: string[] = []

  // Título inicial si existe
  if (title) {
    lines.push(escapeCsvCell(title))
    lines.push('') // Línea en blanco
  }

  // Metadatos iniciales (ej. Proyecto, Cliente, Fecha de reporte)
  const safeMetadata = metadata ?? []
  if (safeMetadata.length > 0) {
    for (const meta of safeMetadata) {
      lines.push(`${escapeCsvCell(meta.label)},${escapeCsvCell(meta.value)}`)
    }
    lines.push('') // Separador antes de la tabla
  }

  // Encabezados de columnas
  const safeColumns = columns ?? []
  const headerRow = safeColumns.map((col) => escapeCsvCell(col.header)).join(',')
  lines.push(headerRow)

  // Renglones de datos
  const safeData = data ?? []
  for (const item of safeData) {
    const row = safeColumns.map((col) => escapeCsvCell(col.accessor(item))).join(',')
    lines.push(row)
  }

  // Unir con saltos de línea de Windows (\r\n) para máxima compatibilidad con Excel
  const csvContent = lines.join('\r\n')

  // Prepend de BOM UTF-8 (\uFEFF)
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  // Sanitizar caracteres prohibidos en nombres de archivo
  const cleanName = (filename || 'exportacion').replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_')
  const finalFilename = cleanName.endsWith('.csv') ? cleanName : `${cleanName}.csv`

  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', finalFilename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
