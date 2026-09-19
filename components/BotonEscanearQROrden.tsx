'use client'

import { useState } from 'react'
import { IconCamara } from '@/components/icons'
import { LectorQRModal } from '@/components/LectorQRModal'
import { vibrarTap } from '@/lib/haptics'

export function BotonEscanearQROrden({
  label = 'Escanear QR',
  className = '',
  size = 'sm',
}: {
  label?: string
  className?: string
  size?: 'xs' | 'sm' | 'md'
}) {
  const [modalAbierto, setModalAbierto] = useState(false)

  const sizeClasses = {
    xs: 'btn-xs px-2.5 py-1 text-xs',
    sm: 'btn-sm px-3 py-1.5 text-xs',
    md: 'px-3.5 py-2 text-sm',
  }[size]

  return (
    <>
      <button
        type="button"
        onClick={() => {
          vibrarTap()
          setModalAbierto(true)
        }}
        className={`btn-secondary inline-flex items-center gap-1.5 font-medium ${sizeClasses} ${className}`}
        title="Abrir escáner de cámara para leer código QR de orden de compra"
      >
        <IconCamara className="size-4 shrink-0 text-primary" />
        <span>{label}</span>
      </button>

      <LectorQRModal
        isOpen={modalAbierto}
        onClose={() => setModalAbierto(false)}
        titulo="Escanear QR de Orden"
        subtitulo="Apunta la cámara a la orden para abrir la recepción en obra"
      />
    </>
  )
}
