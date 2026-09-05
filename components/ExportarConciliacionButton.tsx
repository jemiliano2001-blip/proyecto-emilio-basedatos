'use client'

import { useState } from 'react'
import { IconDescargar } from '@/components/icons'
import { exportToCsv } from '@/lib/export-excel'
import { formatMoneyMx } from '@/lib/money'
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

  const handleExport = () => {
    try {
      setExportando(true)
      const nombreObra = presupuesto?.obra_nombre || 'proyecto'
      const slug = nombreObra
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')

      const fechaIso = new Date().toISOString().slice(0, 10)

      exportToCsv({
        filename: `conciliacion-${slug}-${fechaIso}.csv`,
        title: 'REPORTE DE CONCILIACIÓN Y CIERRE DE PROYECTO',
        metadata: [
          { label: 'Proyecto', value: nombreObra },
          { label: 'Cliente', value: presupuesto?.cliente ?? 'No especificado' },
          { label: 'Estatus del proyecto', value: presupuesto?.estado ?? 'Desconocido' },
          {
            label: 'Presupuesto Total (MXN)',
            value: formatMoneyMx(Number(presupuesto?.presupuesto_mxn) || 0),
          },
          {
            label: 'Gastado Órdenes de Compra (MXN)',
            value: formatMoneyMx(Number(presupuesto?.gastado_ordenes_compra_mxn) || 0),
          },
          {
            label: 'Fletes y Servicios (MXN)',
            value: formatMoneyMx(
              (Number(presupuesto?.fletes_camiones_mxn) || 0) +
                (Number(presupuesto?.servicios_otros_mxn) || 0)
            ),
          },
          {
            label: 'Total Ejecutado Acumulado (MXN)',
            value: formatMoneyMx(Number(presupuesto?.gastado_total_ejecutado_mxn) || 0),
          },
          {
            label: 'Variación / Saldo Final (MXN)',
            value: formatMoneyMx(Number(presupuesto?.variacion_saldo_mxn) || 0),
          },
          {
            label: 'Fecha de Reporte',
            value: new Date().toLocaleString('es-MX'),
          },
        ],
        columns: [
          {
            header: 'Material',
            accessor: (m) =>
              `${m.nombre_base ?? ''}${m.variante ? ` (${m.variante})` : ''}`,
          },
          {
            header: 'Categoría',
            accessor: (m) => m.categoria ?? 'Sin categoría',
          },
          {
            header: 'Unidad de Medida',
            accessor: (m) => m.unidad_medida ?? '',
          },
          {
            header: 'Contratado (Tope Base)',
            accessor: (m) => Number(m.cantidad_contratada) || 0,
          },
          {
            header: 'Traspaso Neto',
            accessor: (m) =>
              (Number(m.traspasos_entrada) || 0) - (Number(m.traspasos_salida) || 0),
          },
          {
            header: 'Tope Efectivo',
            accessor: (m) => Number(m.cantidad_tope_efectiva) || 0,
          },
          {
            header: 'Usado / Comprometido',
            accessor: (m) =>
              (Number(m.cantidad_usada) || 0) + (Number(m.cantidad_comprometida) || 0),
          },
          {
            header: 'Recibido en Sitio',
            accessor: (m) => Number(m.cantidad_recibida_buena_sitio) || 0,
          },
          {
            header: 'Remanente Disponible',
            accessor: (m) => Number(m.cantidad_disponible) || 0,
          },
          {
            header: '% Ejecución',
            accessor: (m) => `${Number.isFinite(Number(m.porcentaje_ejecucion)) ? m.porcentaje_ejecucion : 0}%`,
          },
        ],
        data: materiales ?? [],
      })
    } finally {
      setTimeout(() => setExportando(false), 500)
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={exportando}
      className="btn-secondary text-sm px-3.5 py-2 inline-flex items-center gap-1.5 hover:bg-gray-50"
      title="Descargar reporte en formato Excel (.csv compatible con BOM)"
    >
      <IconDescargar className="h-4 w-4 text-accent" />
      <span>{exportando ? 'Generando…' : 'Exportar Excel'}</span>
    </button>
  )
}
