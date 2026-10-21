'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { IconCamara } from '@/components/icons'
import { CLASE_BOTON_GRANDE, validarFotoRecepcion } from '@/lib/checklist-recepcion'
import { instantaneaArchivo } from '@/lib/adjuntos'
import { vibrarTap } from '@/lib/haptics'

const CameraCaptureModal = dynamic(
  () => import('@/components/CameraCaptureModal').then((mod) => mod.CameraCaptureModal),
  { ssr: false }
)

export function SelectorFoto({
  titulo,
  archivo,
  onArchivo,
  onQuitar,
  onError,
}: {
  titulo: string
  archivo: File | null
  onArchivo: (archivo: File) => void
  onQuitar?: () => void
  onError: (mensaje: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [camaraAbierta, setCamaraAbierta] = useState(false)
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!archivo) {
      setSrc(null)
      return
    }
    const url = URL.createObjectURL(archivo)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [archivo])

  async function aplicar(file: File) {
    const validacion = validarFotoRecepcion(file)
    if (!validacion.ok) {
      onError(validacion.error)
      return
    }
    try {
      const copia = await instantaneaArchivo(file)
      vibrarTap()
      onArchivo(copia)
    } catch {
      onError('No se pudo leer la foto. Tómala otra vez.')
    }
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <p className="text-base font-medium text-foreground">{titulo}</p>
      {src && (
        <figure className="overflow-hidden rounded-xl border border-border bg-card">
          {/* blob local: el optimizador de Next no sirve esta vista. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- foto tomada en el teléfono */}
          <img src={src} alt={titulo} className="max-h-56 w-full object-contain" />
        </figure>
      )}
      <button
        type="button"
        onClick={() => setCamaraAbierta(true)}
        className={`${CLASE_BOTON_GRANDE} border border-border bg-card text-foreground`}
      >
        <IconCamara className="mr-2 h-5 w-5" />
        Tomar foto
      </button>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`${CLASE_BOTON_GRANDE} border border-border bg-card text-foreground`}
      >
        Elegir archivo
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(evento) => {
          const file = evento.target.files?.[0]
          if (file) void aplicar(file)
          evento.target.value = ''
        }}
      />
      {archivo && onQuitar && (
        <button
          type="button"
          onClick={onQuitar}
          className={`${CLASE_BOTON_GRANDE} border border-border bg-card text-foreground`}
        >
          Quitar
        </button>
      )}
      <CameraCaptureModal
        isOpen={camaraAbierta}
        onClose={() => setCamaraAbierta(false)}
        title={titulo}
        onCapture={(file) => {
          setCamaraAbierta(false)
          void aplicar(file)
        }}
      />
    </div>
  )
}
