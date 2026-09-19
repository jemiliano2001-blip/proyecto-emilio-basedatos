import type { CatalogoMaterial } from '@/lib/types'
import { exportarTablaExcelFormal, type ColumnaExcelConfig } from '@/lib/excel-export-base'
import { vibrarExito } from '@/lib/haptics'

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

export function descargarMaterialesCsv(materiales: CatalogoMaterial[], incluirPrecios: boolean) {
  const headers = ['Material', 'Variante', 'Categoría', 'Subcategoría', 'Unidad']
  if (incluirPrecios) headers.push('Precio base MXN')
  const rows = materiales.map((material) => {
    const row: unknown[] = [
      material.nombre_base,
      material.variante,
      material.categoria,
      material.subcategoria,
      material.unidad_medida,
    ]
    if (incluirPrecios) row.push(material.precio_base ?? '')
    return row
  })
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `materiales-seleccionados-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function descargarMaterialesExcel(
  materiales: CatalogoMaterial[],
  incluirPrecios: boolean
): Promise<void> {
  const columnas: ColumnaExcelConfig[] = [
    { header: 'Material Base', width: 28, align: 'left' },
    { header: 'Variante / Calibre', width: 22, align: 'left' },
    { header: 'Categoría', width: 20, align: 'left' },
    { header: 'Subcategoría', width: 20, align: 'left' },
    { header: 'U. Medida', width: 14, align: 'center' },
  ]

  if (incluirPrecios) {
    columnas.push({
      header: 'Precio Base MXN',
      width: 18,
      align: 'right',
      numFmt: '$#,##0.00',
    })
  }

  const filas = materiales.map((m) => {
    const fila: (string | number | null | undefined)[] = [
      m.nombre_base,
      m.variante ?? '—',
      m.categoria ?? 'Sin categoría',
      m.subcategoria ?? 'General',
      m.unidad_medida ?? 'PZA',
    ]
    if (incluirPrecios) {
      fila.push(m.precio_base !== null && m.precio_base !== undefined ? Number(m.precio_base) : null)
    }
    return fila
  })

  const fechaIso = new Date().toISOString().slice(0, 10)
  await exportarTablaExcelFormal(
    {
      nombreHoja: 'Catálogo Materiales',
      titulo: 'CATÁLOGO DE MATERIALES — PROYECTO EMILIO',
      subtitulo: `${materiales.length} materiales exportados`,
      columnas,
      filas,
      orientacion: 'landscape',
    },
    `catalogo-materiales-${fechaIso}.xlsx`
  )
  vibrarExito()
}
