'use client'

import React, { useState, useRef, useTransition } from 'react'
import Image from 'next/image'
import { IconBasura } from '@/components/icons'
import { comprimirImagenEnCliente } from '@/lib/image-compression'
import { analizarCalidadArchivoImagen, DiagnosticoCalidadImagen } from '@/lib/image-quality'
import { CameraCaptureModal } from '@/components/CameraCaptureModal'

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
      setPreviewUrl(url)
      setRemoveExisting(false)
      onChangeFile?.(compressedFile)
    })
  }

  const handleNativeFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0]
    if (!rawFile) {
      setPreviewUrl(removeExisting ? null : (existingUrl ?? null))
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
    setPreviewUrl(null)
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
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>

        {/* Botón rápido de cámara en vivo para Personal de obra */}
        {captureCamera && (
          <button
            type="button"
            onClick={() => setIsCameraModalOpen(true)}
            className="text-xs font-semibold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded-lg border border-teal-200 transition-colors flex items-center gap-1.5"
          >
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping" />
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
        className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
      />

      {isCompressing && (
        <p className="text-xs text-teal-600 animate-pulse font-medium">
          Optimizando fotografía y analizando calidad…
        </p>
      )}

      {/* Vista previa miniatura y metadatos */}
      {previewUrl && (
        <div className="mt-2 p-2.5 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-white border border-gray-200 shrink-0 flex items-center justify-center relative shadow-xs">
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
              <p className="text-xs font-semibold text-ink">
                {existingUrl && previewUrl === existingUrl
                  ? 'Fotografía actual'
                  : 'Nueva fotografía capturada'}
              </p>
              {compressionInfo ? (
                <p className="text-[11px] text-teal-700 mt-0.5">
                  Optimizada: {formatSize(compressionInfo.optimizado)}{' '}
                  <span className="text-gray-400 line-through">
                    ({formatSize(compressionInfo.original)})
                  </span>
                </p>
              ) : (
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Lista para guardarse con el registro.
                </p>
              )}

              {/* Distintivo GPS */}
              {gps?.latitud != null && (
                <p className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1 font-mono">
                  <span>📍 GPS: {gps.latitud.toFixed(4)}, {gps.longitud?.toFixed(4)}</span>
                  {gps.precision && <span>(±{gps.precision}m)</span>}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleRemove}
              className="p-1.5 text-red-500 hover:text-red-700 rounded-lg hover:bg-red-50 transition-colors shrink-0"
              title="Quitar fotografía"
              aria-label="Quitar fotografía"
            >
              <IconBasura className="w-4 h-4" />
            </button>
          </div>

          {/* Diagnóstico de Calidad */}
          {calidadDiagnostico && (
            <div className="pt-1.5 border-t border-gray-200">
              {calidadDiagnostico.esApta ? (
                <div className="flex items-center justify-between text-[11px] text-teal-800">
                  <span className="flex items-center gap-1 font-medium">
                    ✓ Nitidez e iluminación aptas
                  </span>
                  <span className="font-mono text-[10px] bg-teal-100/80 px-1.5 py-0.5 rounded">
                    Score: {Math.round(calidadDiagnostico.score * 100)}%
                  </span>
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                  <p className="font-semibold text-[11px]">Recomendación de calidad:</p>
                  <ul className="list-disc pl-4 text-[11px] space-y-0.5 text-amber-800">
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

      {helpText && <p className="text-xs text-gray-400">{helpText}</p>}

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
