'use client'

import { useState } from 'react'
import { IconWhatsApp, IconCheck } from '@/components/icons'
import {
  generarMensajeWhatsAppOrden,
  generarUrlWhatsApp,
  copiarAlPortapapeles,
  type DatosOrdenWhatsApp,
} from '@/lib/whatsapp-notificacion'
import { vibrarTap, vibrarExito } from '@/lib/haptics'

interface BotonEnviarWhatsAppProps {
  orden: DatosOrdenWhatsApp
  label?: string
  className?: string
  size?: 'xs' | 'sm' | 'md'
}

export function BotonEnviarWhatsApp({
  orden,
  label = 'Enviar WhatsApp',
  className = '',
  size = 'sm',
}: BotonEnviarWhatsAppProps) {
  const [copiado, setCopiado] = useState(false)

  const handleEnviar = async () => {
    vibrarTap()
    const mensaje = generarMensajeWhatsAppOrden(orden)

    // 1. Copiar al portapapeles preventivamente
    await copiarAlPortapapeles(mensaje)
    setCopiado(true)
    vibrarExito()

    // 2. Abrir WhatsApp
    const url = generarUrlWhatsApp({
      telefono: orden.proveedorTelefono,
      mensaje,
    })

    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer')
    }

    setTimeout(() => {
      setCopiado(false)
    }, 3500)
  }

  const sizeClasses = {
    xs: 'btn-xs px-2.5 py-1 text-xs',
    sm: 'btn-sm px-3 py-1.5 text-xs',
    md: 'px-3.5 py-2 text-sm',
  }[size]

  return (
    <button
      type="button"
      onClick={handleEnviar}
      className={`inline-flex items-center gap-1.5 font-semibold rounded-lg transition-colors border shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 ${sizeClasses} ${className}`}
      title={
        orden.proveedorTelefono
          ? `Enviar por WhatsApp al proveedor (${orden.proveedorTelefono})`
          : 'Enviar orden por WhatsApp (copia texto al portapapeles y abre WhatsApp)'
      }
    >
      {copiado ? (
        <>
          <IconCheck className="size-4 shrink-0 text-white" />
          <span>¡Copiado y Abriendo!</span>
        </>
      ) : (
        <>
          <IconWhatsApp className="size-4 shrink-0 text-white" />
          <span>{label}</span>
        </>
      )}
    </button>
  )
}
