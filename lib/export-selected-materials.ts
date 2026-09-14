import type { CatalogoMaterial } from '@/lib/types'

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
