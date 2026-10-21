'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { IconCamara } from '@/components/icons'
import { VistaPreviaArchivo } from '@/components/VistaPreviaArchivo'
import { QuickLookModal } from '@/components/QuickLookModal'
import {
  AVISO_PEGADO,
  adjuntarDesdeCtrlV,
  instantaneaArchivo,
  tipoVistaPrevia,
  validarArchivoFactura,
  type ArchivoMeta,
  type ValidacionArchivo,
} from '@/lib/adjuntos'
import { SIN_DATO } from '@/lib/fechas'
import { vibrarTap } from '@/lib/haptics'

const CameraCaptureModal = dynamic(
  () => import('@/components/CameraCaptureModal').then((mod) => mod.CameraCaptureModal),
  { ssr: false }
)

const ACCEPT_FACTURA =
  'image/*,.pdf,application/pdf,image/gif,text/xml,application/xml,.xml'

interface AdjuntarArchivoProps {
  archivo: ArchivoMeta | null
  disabled?: boolean
  onArchivo: (archivo: File) => void
  onError: (mensaje: string) => void
  onQuitar?: () => void
  validar?: (archivo: ArchivoMeta) => ValidacionArchivo
  proveedor?: string | null
  folio?: string | null
  monto?: string | null
  moneda?: string | null
}

function esCampoDeTexto(destino: EventTarget | null): boolean {
  if (destino instanceof HTMLTextAreaElement) return true
  if (destino instanceof HTMLInputElement) {
    const tipo = destino.type
    return tipo !== 'file' && tipo !== 'button' && tipo !== 'submit'
  }
  return false
}

export function AdjuntarArchivo({
  archivo,
  disabled = false,
  onArchivo,
  onError,
  onQuitar,
  validar = validarArchivoFactura,
  proveedor,
  folio,
  monto,
  moneda,
}: AdjuntarArchivoProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [camaraAbierta, setCamaraAbierta] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)
  const [srcLocal, setSrcLocal] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ampliado, setAmpliado] = useState(false)
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

  const aplicar = useCallback(
    async (file: File, avisoPegado: string | null = null) => {
      const validacion = validar(file)
      if (!validacion.ok) {
        onError(validacion.error)
        return
      }
      let copia: File
      try {
        copia = await instantaneaArchivo(file)
      } catch {
        onError('No se pudo leer el archivo. Vuelve a elegirlo.')
        return
      }
      vibrarTap()
      setAviso(avisoPegado)
      onArchivo(copia)
    },
    [onArchivo, onError, validar]
  )

  useEffect(() => {
    if (disabled || archivo) return

    function onPaste(evento: ClipboardEvent) {
      const resultado = adjuntarDesdeCtrlV({
        destino: esCampoDeTexto(evento.target) ? 'campo' : 'pagina',
        yaHayArchivo: false,
        clipboardData: evento.clipboardData,
      })
      if (resultado.adjuntado || resultado.error) evento.preventDefault()
      if (!resultado.adjuntado || !(resultado.archivo instanceof File)) {
        if (resultado.error) onError(resultado.error)
        return
      }
      void aplicar(resultado.archivo, resultado.aviso)
    }

    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [aplicar, archivo, disabled, onError])

  function soltar(evento: React.DragEvent) {
    evento.preventDefault()
    setArrastrando(false)
    if (disabled || archivo) return
    const file = evento.dataTransfer.files?.[0]
    if (file) void aplicar(file)
  }

  const tipo = archivo ? tipoVistaPrevia(archivo) : 'ninguna'
  const montoVisible = monto?.trim()
    ? moneda?.trim()
      ? `${monto.trim()} ${moneda.trim()}`
      : monto.trim()
    : SIN_DATO

  return (
    <div className="space-y-3">
      {!archivo && (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="Seleccionar archivo de factura"
          aria-disabled={disabled}
          onClick={() => {
            if (!disabled) inputRef.current?.click()
          }}
          onKeyDown={(evento) => {
            if (disabled) return
            if (evento.key === 'Enter' || evento.key === ' ') {
              evento.preventDefault()
              inputRef.current?.click()
            }
          }}
          onDragOver={(evento) => {
            evento.preventDefault()
            if (!disabled) setArrastrando(true)
          }}
          onDragLeave={(evento) => {
            evento.preventDefault()
            setArrastrando(false)
          }}
          onDrop={soltar}
          className={`flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            arrastrando ? 'border-primary bg-primary-soft' : 'border-input bg-muted/40'
          } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
        >
          <span className="text-sm font-medium text-foreground">
            Haz clic o arrastra un screenshot o PDF
          </span>
          <span className="text-sm text-muted-foreground">O presiona Ctrl + V</span>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_FACTURA}
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
        onChange={(evento) => {
          const file = evento.target.files?.[0]
          if (file) void aplicar(file)
          evento.target.value = ''
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setCamaraAbierta(true)}
        className="btn-secondary min-h-14 w-full justify-center text-base"
      >
        <IconCamara className="h-5 w-5" />
        Tomar foto
      </button>
      <p className="text-xs text-muted-foreground">También puedes elegir un XML del SAT.</p>
      {aviso && (
        <p role="status" className="text-sm text-foreground">
          {aviso || AVISO_PEGADO}
        </p>
      )}
      {archivo && (
        <div className="space-y-2">
          <VistaPreviaArchivo tipo={tipo} nombre={archivo.name} src={srcLocal} />
          <div className="flex flex-wrap gap-2">
            {srcLocal && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => setAmpliado(true)}
                className="btn-secondary min-h-11"
              >
                Ampliar
              </button>
            )}
            {onQuitar && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  setAviso(null)
                  setAmpliado(false)
                  onQuitar()
                }}
                className="btn-secondary min-h-11 text-danger"
              >
                Quitar
              </button>
            )}
          </div>
        </div>
      )}
      {ampliado && srcLocal && archivo && (
        <QuickLookModal
          open
          onClose={() => setAmpliado(false)}
          items={[
            {
              url: srcLocal,
              nombre: archivo.name,
              tipo: tipo === 'pdf' ? 'pdf' : 'imagen',
              proveedor: proveedor ?? null,
              folio: folio ?? null,
              monto: montoVisible,
              moneda: moneda ?? null,
            },
          ]}
        />
      )}
      <CameraCaptureModal
        isOpen={camaraAbierta}
        onClose={() => setCamaraAbierta(false)}
        title="Foto de la factura"
        onCapture={(file) => {
          setCamaraAbierta(false)
          void aplicar(file)
        }}
      />
    </div>
  )
}
