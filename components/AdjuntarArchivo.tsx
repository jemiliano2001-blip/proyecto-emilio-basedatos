'use client'

import React, { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { IconCamara, IconClip, IconBasura } from '@/components/icons'
import { VistaPreviaArchivo } from '@/components/VistaPreviaArchivo'
import {
  adjuntarDesdeCtrlV,
  tipoVistaPrevia,
  validarArchivoFactura,
  type ArchivoMeta,
  type ValidacionArchivo,
} from '@/lib/adjuntos'
import { vibrarTap } from '@/lib/haptics'

const CameraCaptureModal = dynamic(
  () => import('@/components/CameraCaptureModal').then((mod) => mod.CameraCaptureModal),
  { ssr: false }
)

const ACCEPT_FACTURA =
  '.pdf,application/pdf,image/jpeg,image/png,image/webp,text/xml,application/xml'

interface AdjuntarArchivoProps {
  archivo: ArchivoMeta | null
  disabled?: boolean
  onArchivo: (archivo: File) => void
  onError: (mensaje: string) => void
  onQuitar?: () => void
  validar?: (archivo: ArchivoMeta) => ValidacionArchivo
}

function esCampoDeTexto(destino: EventTarget | null): boolean {
  return destino instanceof HTMLInputElement || destino instanceof HTMLTextAreaElement
}

export function AdjuntarArchivo({
  archivo,
  disabled = false,
  onArchivo,
  onError,
  onQuitar,
  validar = validarArchivoFactura,
}: AdjuntarArchivoProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [camaraAbierta, setCamaraAbierta] = useState(false)
  const [srcLocal, setSrcLocal] = useState<string | null>(null)
  const archivoBlob = archivo instanceof File ? archivo : null

  useEffect(() => {
    if (!archivoBlob) {
      setSrcLocal(null)
      return
    }
    const tipo = tipoVistaPrevia(archivoBlob)
    if (tipo !== 'imagen' && tipo !== 'pdf') {
      setSrcLocal(null)
      return
    }
    const url = URL.createObjectURL(archivoBlob)
    setSrcLocal(url)
    return () => URL.revokeObjectURL(url)
  }, [archivoBlob])

  useEffect(() => {
    if (disabled) return

    function onPaste(evento: ClipboardEvent) {
      const tieneArchivo = (evento.clipboardData?.files?.length ?? 0) > 0
      if (esCampoDeTexto(evento.target) && !tieneArchivo) return
      const resultado = adjuntarDesdeCtrlV({
        key: 'v',
        ctrlKey: true,
        clipboardData: evento.clipboardData,
      })
      if (tieneArchivo || resultado.adjuntado) evento.preventDefault()
      if (!resultado.adjuntado || !(resultado.archivo instanceof File)) {
        if (resultado.error) onError(resultado.error)
        return
      }
      onArchivo(resultado.archivo)
    }

    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [disabled, onArchivo, onError])

  function tomar(file: File | null | undefined) {
    if (!file) return
    const validacion = validar(file)
    if (!validacion.ok) {
      onError(validacion.error)
      return
    }
    vibrarTap()
    onArchivo(file)
  }

  const tipo = archivo ? tipoVistaPrevia(archivo) : 'ninguna'

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setCamaraAbierta(true)}
          className="btn-secondary min-h-14 justify-center text-sm"
        >
          <IconCamara className="h-5 w-5" />
          Tomar foto
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="btn-secondary min-h-14 justify-center text-sm"
        >
          <IconClip className="h-5 w-5" />
          Elegir archivo
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_FACTURA}
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
        onChange={(evento) => {
          const file = evento.target.files?.[0]
          tomar(file)
          evento.target.value = ''
        }}
      />
      <p className="text-xs text-muted-foreground">
        También puedes pegar una imagen o un archivo con Ctrl+V. PDF, foto o XML, hasta 30 MB.
      </p>
      {archivo && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs font-medium text-foreground">{archivo.name}</p>
            {onQuitar && (
              <button
                type="button"
                disabled={disabled}
                onClick={onQuitar}
                className="inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-danger"
              >
                <IconBasura className="h-4 w-4" />
                Quitar
              </button>
            )}
          </div>
          <VistaPreviaArchivo tipo={tipo} nombre={archivo.name} src={srcLocal} />
        </div>
      )}
      <CameraCaptureModal
        isOpen={camaraAbierta}
        onClose={() => setCamaraAbierta(false)}
        title="Foto de la factura"
        onCapture={(file) => {
          setCamaraAbierta(false)
          tomar(file)
        }}
      />
    </div>
  )
}
