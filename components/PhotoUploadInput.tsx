'use client'

import React, { useState, useRef, useTransition } from 'react'
import Image from 'next/image'
import { IconBasura } from '@/components/icons'
import { comprimirImagenEnCliente } from '@/lib/image-compression'

interface PhotoUploadInputProps {
  id: string
  name: string
  label: string
  existingUrl?: string | null
  required?: boolean
  captureCamera?: boolean
  helpText?: string
  onChangeFile?: (file: File | null) => void
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
}: PhotoUploadInputProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingUrl ?? null)
  const [isCompressing, startCompressTransition] = useTransition()
  const [compressionInfo, setCompressionInfo] = useState<{ original: number; optimizado: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0]
    if (!rawFile) {
      setPreviewUrl(existingUrl ?? null)
      setCompressionInfo(null)
      onChangeFile?.(null)
      return
    }

    startCompressTransition(async () => {
      // Comprimir en cliente para ahorrar datos móviles en campo
      const originalSize = rawFile.size
      const compressedFile = await comprimirImagenEnCliente(rawFile, 1600, 0.82)
      const compressedSize = compressedFile.size

      setCompressionInfo({ original: originalSize, optimizado: compressedSize })

      // Asignar el archivo comprimido al input mediante DataTransfer si el navegador lo soporta
      try {
        const dt = new DataTransfer()
        dt.items.add(compressedFile)
        if (fileInputRef.current) {
          fileInputRef.current.files = dt.files
        }
      } catch {
        // En navegadores que no permitan reasignar DataTransfer a input, se usa el callback o el file original
      }

      const url = URL.createObjectURL(compressedFile)
      setPreviewUrl(url)
      onChangeFile?.(compressedFile)
    })
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setPreviewUrl(null)
    setCompressionInfo(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onChangeFile?.(null)
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {/* Input oculto de foto existente si se mantiene */}
      {existingUrl && (
        <input type="hidden" name={`${name}_existente`} value={existingUrl} />
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
        onChange={handleFile}
        className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
      />

      {isCompressing && (
        <p className="text-xs text-teal-600 animate-pulse font-medium">
          Optimizando fotografía para subida rápida…
        </p>
      )}

      {/* Vista previa miniatura */}
      {previewUrl && (
        <div className="mt-2 flex items-center gap-3 p-2.5 bg-gray-50 rounded-xl border border-gray-200">
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
                : 'Nueva fotografía seleccionada'}
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
      )}

      {helpText && <p className="text-xs text-gray-400">{helpText}</p>}
    </div>
  )
}
