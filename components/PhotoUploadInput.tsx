'use client'

import React, { useState, useRef, useTransition, useEffect } from 'react'
import Image from 'next/image'
import { IconBasura, IconCheck, IconUbicacion } from '@/components/icons'
import { comprimirImagenEnCliente } from '@/lib/image-compression'
import { analizarCalidadArchivoImagen, DiagnosticoCalidadImagen } from '@/lib/image-quality'
import { vibrarTap, vibrarExito } from '@/lib/haptics'
import dynamic from 'next/dynamic'

const CameraCaptureModal = dynamic(
  () => import('@/components/CameraCaptureModal').then((mod) => mod.CameraCaptureModal),
  { ssr: false }
)

interface GpsMetadata {
  latitud: number | null
  longitud: number | null
  precision: number | null
}

interface PhotoUploadInputProps {
  id: string
  name: string
  label: string
  existingUrl?: string | null
  required?: boolean
  captureCamera?: boolean
  helpText?: string
  onChangeFile?: (file: File | null) => void
  onMetadataChange?: (meta: {
    gps: GpsMetadata | null
    calidad: DiagnosticoCalidadImagen | null
  }) => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

export function PhotoUploadInput({
  id,
  name,
  label,
  existingUrl,
  required = false,
  captureCamera = false,
  helpText,
  onChangeFile,
  onMetadataChange,
}: PhotoUploadInputProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingUrl ?? null)
  const [removeExisting, setRemoveExisting] = useState(false)
  const [isCompressing, startCompressTransition] = useTransition()
  const [compressionInfo, setCompressionInfo] = useState<{ original: number; optimizado: number } | null>(null)
  const [calidadDiagnostico, setCalidadDiagnostico] = useState<DiagnosticoCalidadImagen | null>(null)
  const [gps, setGps] = useState<GpsMetadata | null>(null)
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      setPreviewUrl((prev) => {
        if (prev && prev.startsWith('blob:')) {
          URL.revokeObjectURL(prev)
        }
        return null
      })
    }
  }, [])

  const processAndApplyFile = async (rawFile: File, gpsMeta?: GpsMetadata) => {
    startCompressTransition(async () => {
      // 1. Comprimir en cliente para ahorrar datos móviles en campo
      const originalSize = rawFile.size
      const compressedFile = await comprimirImagenEnCliente(rawFile, 1600, 0.82)
      const compressedSize = compressedFile.size
      setCompressionInfo({ original: originalSize, optimizado: compressedSize })

      // 2. Evaluar nitidez, iluminación y resolución
      const diag = await analizarCalidadArchivoImagen(compressedFile)
      setCalidadDiagnostico(diag)

      // 3. Obtener GPS si no se pasó previamente y el navegador lo soporta
      let currentGps = gpsMeta ?? gps
      if (!currentGps && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) => {
            navigator.geolocation.getCurrentPosition(res, rej, {
              enableHighAccuracy: true,
              timeout: 4000,
              maximumAge: 60000,
            })
          })
          currentGps = {
            latitud: pos.coords.latitude,
            longitud: pos.coords.longitude,
            precision: Math.round(pos.coords.accuracy * 10) / 10,
          }
          setGps(currentGps)
        } catch {
          // Si deniega o falla, continuar sin bloquear
        }
      } else if (gpsMeta) {
        setGps(gpsMeta)
      }

      onMetadataChange?.({ gps: currentGps, calidad: diag })

      // 4. Asignar el archivo comprimido al input nativo para envíos por FormData
      try {
        const dt = new DataTransfer()
        dt.items.add(compressedFile)
        if (fileInputRef.current) {
          fileInputRef.current.files = dt.files
        }
      } catch {
        // Fallback en navegadores donde DataTransfer esté restringido
      }

      const url = URL.createObjectURL(compressedFile)
      setPreviewUrl((prev) => {
        if (prev && prev.startsWith('blob:')) {
          URL.revokeObjectURL(prev)
        }
        return url
      })
      setRemoveExisting(false)
      onChangeFile?.(compressedFile)
      vibrarExito()
    })
  }

  const handleNativeFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0]
    if (!rawFile) {
      setPreviewUrl((prev) => {
        if (prev && prev.startsWith('blob:')) {
          URL.revokeObjectURL(prev)
        }
        return removeExisting ? null : (existingUrl ?? null)
      })
      setCompressionInfo(null)
      setCalidadDiagnostico(null)
      onChangeFile?.(null)
      onMetadataChange?.({ gps: null, calidad: null })
      return
    }
    await processAndApplyFile(rawFile)
  }

  const handleCameraCapture = (
    capturedFile: File,
    meta: {
      latitud: number | null
      longitud: number | null
      precision: number | null
      resolucion: string
      calidadScore: number
    }
  ) => {
    const gpsInfo: GpsMetadata = {
      latitud: meta.latitud,
      longitud: meta.longitud,
      precision: meta.precision,
    }
    void processAndApplyFile(capturedFile, gpsInfo)
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setPreviewUrl((prev) => {
      if (prev && prev.startsWith('blob:')) {
        URL.revokeObjectURL(prev)
      }
      return null
    })
    setCompressionInfo(null)
    setCalidadDiagnostico(null)
    setGps(null)
    setRemoveExisting(true)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onChangeFile?.(null)
    onMetadataChange?.({ gps: null, calidad: null })
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="block text-sm font-medium text-foreground">
          {label} {required && <span className="text-danger">*</span>}
        </label>

        {/* Botón rápido de cámara en vivo para Personal de obra */}
        {captureCamera && (
          <button
            type="button"
            onClick={() => {
              vibrarTap()
              setIsCameraModalOpen(true)
            }}
            className="text-xs font-semibold text-primary hover:text-primary-soft-foreground bg-primary-soft hover:bg-primary-soft px-2.5 py-1 rounded-lg border border-primary/30 transition-colors flex items-center gap-1.5"
          >
            <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
            Abrir cámara
          </button>
        )}
      </div>

      {/* Inputs ocultos de metadatos para persistencia en el servidor */}
      {existingUrl && !removeExisting && (
        <input type="hidden" name={`${name}_existente`} value={existingUrl} />
      )}
      {removeExisting && <input type="hidden" name={`${name}_eliminar`} value="true" />}
      {gps?.latitud != null && (
        <input type="hidden" name={`${name}_latitud`} value={gps.latitud} />
      )}
      {gps?.longitud != null && (
        <input type="hidden" name={`${name}_longitud`} value={gps.longitud} />
      )}
      {gps?.precision != null && (
        <input type="hidden" name={`${name}_precision_m`} value={gps.precision} />
      )}
      {calidadDiagnostico && (
        <>
          <input
            type="hidden"
            name={`${name}_calidad_score`}
            value={calidadDiagnostico.score}
          />
          <input
            type="hidden"
            name={`${name}_resolucion`}
            value={calidadDiagnostico.resolucionPx}
          />
        </>
      )}

      {/* Input de archivo nativo */}
      <input
        ref={fileInputRef}
        id={id}
        name={name}
        type="file"
        accept="image/*"
        capture={captureCamera ? 'environment' : undefined}
        required={required && !previewUrl}
        onChange={handleNativeFileChange}
        className="block w-full text-xs text-muted-foreground file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary-soft file:text-primary hover:file:bg-primary-soft cursor-pointer"
      />

      {isCompressing && (
        <p className="text-xs text-primary animate-pulse font-medium">
          Optimizando fotografía y analizando calidad…
        </p>
      )}

      {/* Vista previa miniatura y metadatos */}
      {previewUrl && (
        <div className="mt-2 p-2.5 bg-muted/50 rounded-xl border border-border space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-card border border-border shrink-0 flex items-center justify-center relative shadow-xs">
              <Image
                src={previewUrl}
                alt="Vista previa de foto"
                width={64}
                height={64}
                unoptimized
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground">
                {existingUrl && previewUrl === existingUrl
                  ? 'Fotografía actual'
                  : 'Nueva fotografía capturada'}
              </p>
              {compressionInfo ? (
                <p className="text-[11px] text-primary mt-0.5">
                  Optimizada: {formatSize(compressionInfo.optimizado)}{' '}
                  <span className="text-muted-foreground line-through">
                    ({formatSize(compressionInfo.original)})
                  </span>
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Lista para guardarse con el registro.
                </p>
              )}

              {/* Distintivo GPS */}
              {gps?.latitud != null && (
                <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1 font-mono">
                  <IconUbicacion className="size-3 shrink-0" />
                  <span>GPS {gps.latitud.toFixed(4)}, {gps.longitud?.toFixed(4)}</span>
                  {gps.precision && <span>(±{gps.precision}m)</span>}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleRemove}
              className="p-1.5 text-danger hover:text-danger-soft-foreground rounded-lg hover:bg-danger-soft transition-colors shrink-0"
              title="Quitar fotografía"
              aria-label="Quitar fotografía"
            >
              <IconBasura className="w-4 h-4" />
            </button>
          </div>

          {/* Diagnóstico de Calidad */}
          {calidadDiagnostico && (
            <div className="pt-1.5 border-t border-border">
              {calidadDiagnostico.esApta ? (
                <div className="flex items-center justify-between text-[11px] text-primary-soft-foreground">
                  <span className="flex items-center gap-1 font-medium">
                    <IconCheck className="size-3.5" />
                    Nitidez e iluminación aptas
                  </span>
                  <span className="font-mono text-[10px] bg-primary-soft/80 px-1.5 py-0.5 rounded">
                    Score: {Math.round(calidadDiagnostico.score * 100)}%
                  </span>
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-warning-soft border border-warning/30 text-warning-soft-foreground text-xs space-y-1">
                  <p className="font-semibold text-[11px]">Recomendación de calidad:</p>
                  <ul className="list-disc pl-4 text-[11px] space-y-0.5 text-warning-soft-foreground">
                    {calidadDiagnostico.mensajes.map((m, idx) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}

      {/* Modal de Cámara en vivo */}
      {isCameraModalOpen && (
        <CameraCaptureModal
          isOpen={isCameraModalOpen}
          onClose={() => setIsCameraModalOpen(false)}
          onCapture={handleCameraCapture}
          title={`Capturar: ${label}`}
        />
      )}
    </div>
  )
}
