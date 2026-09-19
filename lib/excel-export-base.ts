import type ExcelJS from 'exceljs'

export const COLOR_HEADER_BG = 'FF132A45' // Navy corporativo Proyecto Emilio
export const COLOR_HEADER_FG = 'FFFFFFFF' // Blanco
export const COLOR_ACCENT = 'FF1E7F7A' // Teal corporativo
export const COLOR_ZEBRA = 'FFF8FAFC' // Fondo cebra tenue (Slate 50)
export const COLOR_TOTAL_BG = 'FFF1F5F9' // Fondo fila total (Slate 100)
export const COLOR_BORDER = 'FFCBD5E1' // Bordes Slate 300
export const COLOR_TEXT = 'FF0F172A' // Texto oscuro
export const COLOR_MUTED = 'FF64748B' // Texto secundario

export type ColumnaExcelConfig = {
  header: string
  width: number
  align?: 'left' | 'center' | 'right'
  numFmt?: string
  wrapText?: boolean
}

export type TotalColumnaConfig = {
  colIndex: number // 1-indexed (columna de Excel)
  valor: number | string
  numFmt?: string
  align?: 'left' | 'center' | 'right'
}

export type MetadatoExcel = {
  label: string
  value: string | number | null | undefined
}

export type OpcionesTablaExcel = {
  nombreHoja: string
  titulo: string
  subtitulo?: string
  metadatos?: MetadatoExcel[]
  columnas: ColumnaExcelConfig[]
  filas: (string | number | boolean | null | undefined)[][]
  totales?: {
    labelColSpan: number
    label: string
    valores: TotalColumnaConfig[]
  }
  orientacion?: 'portrait' | 'landscape'
  generadoEn?: Date
}

export function bordeFino(): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: COLOR_BORDER } }
  return { top: side, left: side, bottom: side, right: side }
}

export function bordeTotal(): Partial<ExcelJS.Borders> {
  const sideFino: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: COLOR_BORDER } }
  const sideDoble: Partial<ExcelJS.Border> = { style: 'double', color: { argb: COLOR_HEADER_BG } }
  return { top: sideFino, left: sideFino, bottom: sideDoble, right: sideFino }
}

export function fechaIso(dia: Date | string | null | undefined): string {
  if (!dia) return '—'
  if (typeof dia === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(dia)) return dia.slice(0, 10)
    const d = new Date(dia)
    if (Number.isNaN(d.getTime())) return dia
    return d.toISOString().slice(0, 10)
  }
  if (dia instanceof Date && !Number.isNaN(dia.getTime())) {
    return dia.toISOString().slice(0, 10)
  }
  return '—'
}

/**
 * Higieniza cadenas para que sean seguras como nombre de archivo en Windows y navegadores.
 */
export function sanitizarNombreArchivo(texto: string | null | undefined): string {
  if (!texto || typeof texto !== 'string') return 'archivo'
  const limpio = texto
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 70)
  return limpio || 'archivo'
}

/**
 * Detona la descarga en el navegador de un archivo Excel a partir de su ArrayBuffer/Uint8Array.
 */
export function descargarExcelEnNavegador(
  buffer: ArrayBuffer | Uint8Array,
  nombreArchivo: string
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const safeFilename = nombreArchivo.endsWith('.xlsx') ? nombreArchivo : `${nombreArchivo}.xlsx`
  const blob = new Blob([buffer as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = safeFilename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Construye un Workbook formal de ExcelJS con membrete institucional de Proyecto Emilio,
 * encabezados oscuros Navy, bandas cebra, formatos numéricos y totales.
 */
export async function construirWorkbookFormal(
  opts: OpcionesTablaExcel
): Promise<ExcelJS.Workbook> {
  const generadoEn = opts.generadoEn ?? new Date()
  const generadoLabel = generadoEn.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  // Import dinámico para no penalizar el bundle inicial
  const ExcelJSModule = await import('exceljs')
  const ExcelJSClass = (
    'default' in ExcelJSModule ? ExcelJSModule.default : ExcelJSModule
  ) as unknown as typeof import('exceljs')

  const workbook = new ExcelJSClass.Workbook()
  workbook.creator = 'Proyecto Emilio — Sistema de Trazabilidad'
  workbook.created = generadoEn

  const colCount = Math.max(opts.columnas.length, 1)
  const metadatosList = (opts.metadatos ?? []).filter((m) => m && m.value !== undefined && m.value !== null && m.value !== '')

  // Cálculo de filas de encabezado:
  // Fila 1: Título institucional
  // Fila 2: Subtítulo / resumen
  // Filas 3..N: Metadatos en pares si existen
  // Fila separadora
  // Fila de encabezados de columna
  let currentRow = 1

  const sheet = workbook.addWorksheet(opts.nombreHoja.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 3 + metadatosList.length + 1, showGridLines: true }],
    pageSetup: {
      orientation: opts.orientacion ?? 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  })

  sheet.columns = opts.columnas.map((c) => ({ width: Math.max(c.width, 10) }))

  // Fila 1: Membrete y Título
  sheet.mergeCells(currentRow, 1, currentRow, colCount)
  const cellTitulo = sheet.getCell(currentRow, 1)
  cellTitulo.value = opts.titulo.toUpperCase()
  cellTitulo.font = { bold: true, size: 14, color: { argb: COLOR_HEADER_BG } }
  cellTitulo.alignment = { vertical: 'middle', horizontal: 'left' }
  sheet.getRow(currentRow).height = 24
  currentRow++

  // Fila 2: Subtítulo y Fecha
  sheet.mergeCells(currentRow, 1, currentRow, colCount)
  const cellSub = sheet.getCell(currentRow, 1)
  const partesSub = [
    opts.subtitulo,
    `${opts.filas.length} registros`,
    `Emitido el ${generadoLabel}`,
  ].filter(Boolean)
  cellSub.value = partesSub.join('  ·  ')
  cellSub.font = { size: 9.5, italic: true, color: { argb: COLOR_MUTED } }
  cellSub.alignment = { vertical: 'middle', horizontal: 'left' }
  sheet.getRow(currentRow).height = 18
  currentRow++

  // Filas de Metadatos (ej. Proyecto, Cliente, Presupuesto, Estatus)
  if (metadatosList.length > 0) {
    for (const meta of metadatosList) {
      const row = sheet.getRow(currentRow)
      row.height = 18
      const cellLbl = row.getCell(1)
      cellLbl.value = `${meta.label}:`
      cellLbl.font = { bold: true, size: 9.5, color: { argb: COLOR_TEXT } }
      cellLbl.alignment = { vertical: 'middle', horizontal: 'left' }

      if (colCount > 1) {
        sheet.mergeCells(currentRow, 2, currentRow, colCount)
        const cellVal = row.getCell(2)
        cellVal.value = String(meta.value)
        cellVal.font = { size: 9.5, color: { argb: COLOR_TEXT } }
        cellVal.alignment = { vertical: 'middle', horizontal: 'left' }
      }
      currentRow++
    }
  }

  // Fila separadora en blanco
  sheet.getRow(currentRow).height = 8
  currentRow++

  // Fila de Encabezados de Tabla
  const headerRowNum = currentRow
  const headerRow = sheet.getRow(headerRowNum)
  headerRow.height = 24

  opts.columnas.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1)
    cell.value = col.header
    cell.font = { bold: true, size: 9.5, color: { argb: COLOR_HEADER_FG } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLOR_HEADER_BG },
    }
    cell.alignment = {
      vertical: 'middle',
      horizontal: col.align ?? 'left',
      wrapText: Boolean(col.wrapText),
    }
    cell.border = bordeFino()
  })
  currentRow++

  // Filas de Datos
  opts.filas.forEach((filaData, rowIdx) => {
    const row = sheet.getRow(currentRow)
    row.height = 20
    const esZebra = rowIdx % 2 === 1

    opts.columnas.forEach((col, colIdx) => {
      const cell = row.getCell(colIdx + 1)
      const val = filaData[colIdx]

      cell.value = val === null || val === undefined ? '' : val
      cell.font = { size: 9, color: { argb: COLOR_TEXT } }
      cell.alignment = {
        vertical: 'middle',
        horizontal: col.align ?? 'left',
        wrapText: Boolean(col.wrapText),
      }
      if (col.numFmt) {
        cell.numFmt = col.numFmt
      }

      if (esZebra) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: COLOR_ZEBRA },
        }
      }
      cell.border = bordeFino()
    })
    currentRow++
  })

  // Fila de Totales si aplica
  if (opts.totales && opts.totales.valores.length > 0) {
    const totalRow = sheet.getRow(currentRow)
    totalRow.height = 22

    // Label de totales (hace merge según labelColSpan)
    const span = Math.min(Math.max(opts.totales.labelColSpan, 1), colCount)
    if (span > 1) {
      sheet.mergeCells(currentRow, 1, currentRow, span)
    }
    const cellTotalLabel = totalRow.getCell(1)
    cellTotalLabel.value = opts.totales.label.toUpperCase()
    cellTotalLabel.font = { bold: true, size: 9.5, color: { argb: COLOR_HEADER_BG } }
    cellTotalLabel.alignment = { vertical: 'middle', horizontal: 'right' }
    cellTotalLabel.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLOR_TOTAL_BG },
    }
    cellTotalLabel.border = bordeTotal()

    // Celdas vacías entre el label y los valores
    for (let c = 1; c <= colCount; c++) {
      const cell = totalRow.getCell(c)
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: COLOR_TOTAL_BG },
      }
      cell.border = bordeTotal()
    }

    // Valores calculados
    opts.totales.valores.forEach((tot) => {
      const cell = totalRow.getCell(tot.colIndex)
      cell.value = tot.valor
      cell.font = { bold: true, size: 9.5, color: { argb: COLOR_HEADER_BG } }
      cell.alignment = {
        vertical: 'middle',
        horizontal: tot.align ?? 'right',
      }
      if (tot.numFmt) {
        cell.numFmt = tot.numFmt
      }
      cell.border = bordeTotal()
    })
    currentRow++
  }

  return workbook
}

/**
 * Atajo para construir y descargar un archivo Excel formal directamente en el navegador.
 */
export async function exportarTablaExcelFormal(
  opts: OpcionesTablaExcel,
  nombreArchivo: string
): Promise<void> {
  const workbook = await construirWorkbookFormal(opts)
  const buffer = await workbook.xlsx.writeBuffer()
  descargarExcelEnNavegador(buffer, nombreArchivo)
}
