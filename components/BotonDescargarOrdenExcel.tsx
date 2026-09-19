'use client'

import { useState } from 'react'
import { IconDescargar } from '@/components/icons'
import { descargarOrdenCompraExcel, type DatosOrdenExcel } from '@/lib/orden-excel-export'
import { vibrarTap } from '@/lib/haptics'

interface BotonDescargarOrdenExcelProps {
  orden: DatosOrdenExcel
  label?: string
  className?: string
  size?: 'xs' | 'sm' | 'md'
}

export function BotonDescargarOrdenExcel({
  orden,
  label = 'Exportar Excel',
  className = '',
  size = 'sm',
}: BotonDescargarOrdenExcelProps) {
  const [generando, setGenerando] = useState(false)

  const handleDescargar = async () => {
    vibrarTap()
    try {
      setGenerando(true)
      await descargarOrdenCompraExcel(orden)
    } catch (err) {
      console.error('Error al exportar orden a Excel:', err)
    } finally {
      setTimeout(() => setGenerando(false), 600)
    }
  }

  const sizeClasses = {
    xs: 'btn-xs px-2.5 py-1 text-xs',
    sm: 'btn-sm px-3 py-1.5 text-xs',
    md: 'px-3.5 py-2 text-sm',
  }[size]

  return (
    <button
      type="button"
      onClick={handleDescargar}
      disabled={generando}
      className={`btn-secondary inline-flex items-center gap-1.5 font-medium ${sizeClasses} ${className}`}
      title="Descargar orden de compra en formato formal de Excel (.xlsx)"
    >
      <IconDescargar className="size-4 shrink-0 text-primary" />
      <span>{generando ? 'Generando Excel…' : label}</span>
    </button>
  )
}
