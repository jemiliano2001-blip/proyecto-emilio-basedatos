'use client'

import { useState, useRef, useEffect } from 'react'
import { IconDescargar } from '@/components/icons'
import { exportToCsv } from '@/lib/export-excel'
import { exportarTablaExcelFormal, type ColumnaExcelConfig } from '@/lib/excel-export-base'
import { formatMoneyMx } from '@/lib/money'
import { vibrarTap, vibrarExito } from '@/lib/haptics'
import type {
  ConciliacionMaterialObra,
  ConciliacionPresupuestoObra,
} from '@/lib/types'

export function ExportarConciliacionButton({
  presupuesto,
  materiales,
}: {
  presupuesto: ConciliacionPresupuestoObra
  materiales: ConciliacionMaterialObra[]
}) {
  const [exportando, setExportando] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleExport = async () => {
    vibrarTap()
    try {
      setExportando(true)
      const nombreObra = presupuesto?.obra_nombre || 'proyecto'
      const slug = nombreObra
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')

      const fechaIso = new Date().toISOString().slice(0, 10)
      const filenameBase = `conciliacion-${slug}-${fechaIso}`

      const columnasExcel: ColumnaExcelConfig[] = [
        { header: 'Material', width: 34, align: 'left' },
        { header: 'Categoría', width: 22, align: 'left' },
        { header: 'U. Medida', width: 14, align: 'center' },
        { header: 'Contratado (Tope Base)', width: 18, align: 'right', numFmt: '#,##0.00' },
        { header: 'Traspaso Neto', width: 15, align: 'right', numFmt: '#,##0.00' },
        { header: 'Tope Efectivo', width: 18, align: 'right', numFmt: '#,##0.00' },
        { header: 'Usado / Comprometido', width: 20, align: 'right', numFmt: '#,##0.00' },
        { header: 'Recibido en Sitio', width: 18, align: 'right', numFmt: '#,##0.00' },
        { header: 'Remanente Disponible', width: 20, align: 'right', numFmt: '#,##0.00' },
        { header: '% Ejecución', width: 14, align: 'right', numFmt: '0.0%' },
      ]

      const filasExcel = (materiales ?? []).map((m) => {
        const materialNombre = `${m.nombre_base ?? ''}${m.variante ? ` (${m.variante})` : ''}`
        const contratado = Number(m.cantidad_contratada) || 0
        const traspasoNeto = (Number(m.traspasos_entrada) || 0) - (Number(m.traspasos_salida) || 0)
        const topeEfectivo = Number(m.cantidad_tope_efectiva) || 0
        const usado = (Number(m.cantidad_usada) || 0) + (Number(m.cantidad_comprometida) || 0)
        const recibido = Number(m.cantidad_recibida_buena_sitio) || 0
        const disponible = Number(m.cantidad_disponible) || 0
        const pct = (Number(m.porcentaje_ejecucion) || 0) / 100 // En Excel 0.5 es 50%

        return [
          materialNombre,
          m.categoria ?? 'Sin categoría',
          m.unidad_medida ?? 'PZA',
          contratado,
          traspasoNeto,
          topeEfectivo,
          usado,
          recibido,
          disponible,
          pct,
        ]
      })

      const metadatos = [
        { label: 'Proyecto', value: nombreObra },
        { label: 'Cliente', value: presupuesto?.cliente ?? 'No especificado' },
        { label: 'Estatus del proyecto', value: presupuesto?.estado ?? 'Desconocido' },
        {
          label: 'Presupuesto Total Contratado',
          value: formatMoneyMx(Number(presupuesto?.presupuesto_mxn) || 0),
        },
        {
          label: 'Gastado en Órdenes de Compra',
          value: formatMoneyMx(Number(presupuesto?.gastado_ordenes_compra_mxn) || 0),
        },
        {
          label: 'Fletes y Servicios Auxiliares',
          value: formatMoneyMx(
            (Number(presupuesto?.fletes_camiones_mxn) || 0) +
              (Number(presupuesto?.servicios_otros_mxn) || 0)
          ),
        },
        {
          label: 'Total Ejecutado Acumulado',
          value: formatMoneyMx(Number(presupuesto?.gastado_total_ejecutado_mxn) || 0),
        },
        {
          label: 'Variación / Saldo Final Disponible',
          value: formatMoneyMx(Number(presupuesto?.variacion_saldo_mxn) || 0),
        },
      ]

      try {
        await exportarTablaExcelFormal(
          {
            nombreHoja: 'Conciliación de Obra',
            titulo: 'REPORTE DE CONCILIACIÓN Y CIERRE DE PROYECTO',
            subtitulo: `Proyecto: ${nombreObra}`,
            metadatos,
            columnas: columnasExcel,
            filas: filasExcel,
            orientacion: 'landscape',
          },
          `${filenameBase}.xlsx`
        )
        vibrarExito()
      } catch (excelError) {
        console.warn('Fallo exportación ExcelJS, usando fallback CSV:', excelError)
        // Fallback a CSV
        exportToCsv({
          filename: `${filenameBase}.csv`,
          title: 'REPORTE DE CONCILIACIÓN Y CIERRE DE PROYECTO',
          metadata: metadatos.map((m) => ({ label: m.label, value: String(m.value) })),
          columns: [
            { header: 'Material', accessor: (m) => `${m.nombre_base ?? ''}${m.variante ? ` (${m.variante})` : ''}` },
            { header: 'Categoría', accessor: (m) => m.categoria ?? 'Sin categoría' },
            { header: 'Unidad de Medida', accessor: (m) => m.unidad_medida ?? '' },
            { header: 'Contratado (Tope Base)', accessor: (m) => Number(m.cantidad_contratada) || 0 },
            {
              header: 'Traspaso Neto',
              accessor: (m) => (Number(m.traspasos_entrada) || 0) - (Number(m.traspasos_salida) || 0),
            },
            { header: 'Tope Efectivo', accessor: (m) => Number(m.cantidad_tope_efectiva) || 0 },
            {
              header: 'Usado / Comprometido',
              accessor: (m) => (Number(m.cantidad_usada) || 0) + (Number(m.cantidad_comprometida) || 0),
            },
            { header: 'Recibido en Sitio', accessor: (m) => Number(m.cantidad_recibida_buena_sitio) || 0 },
            { header: 'Remanente Disponible', accessor: (m) => Number(m.cantidad_disponible) || 0 },
            {
              header: '% Ejecución',
              accessor: (m) => `${Number.isFinite(Number(m.porcentaje_ejecucion)) ? m.porcentaje_ejecucion : 0}%`,
            },
          ],
          data: materiales ?? [],
        })
      }
    } finally {
      timerRef.current = setTimeout(() => setExportando(false), 500)
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={exportando}
      className="btn-secondary text-sm px-3.5 py-2 hover:bg-muted/50"
      title="Descargar reporte formal en formato Microsoft Excel (.xlsx)"
    >
      <IconDescargar className="h-4 w-4 text-primary" />
      <span>{exportando ? 'Generando Excel…' : 'Exportar Excel (.xlsx)'}</span>
    </button>
  )
}
