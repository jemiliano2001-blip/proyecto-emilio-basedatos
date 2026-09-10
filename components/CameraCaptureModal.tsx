'use client'

import React, { useEffect, useRef, useState } from 'react'
import { IconCerrar } from '@/components/icons'
import { comprimirImagenEnCliente } from '@/lib/image-compression'
import { evaluarBufferImagen, DiagnosticoCalidadImagen } from '@/lib/image-quality'

interface CameraCaptureModalProps {
  isOpen: boolean
  onClose: () => void
  onCapture: (
    file: File,
    meta: {
      latitud: number | null
      longitud: number | null
      precision: number | null
      resolucion: string
      calidadScore: number
    }
  ) => void
  initialFacingMode?: 'environment' | 'user'
  title?: string
}

export function CameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
  initialFacingMode = 'environment',
  title = 'Cámara en Obra',
}: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>(initialFacingMode)
  const [hasTorch, setHasTorch] = useState(false)
  const [isTorchOn, setIsTorchOn] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [liveQuality, setLiveQuality] = useState<DiagnosticoCalidadImagen | null>(null)

  // Iniciar flujo de video cuando se abre el modal
  useEffect(() => {
    if (!isOpen) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        setStream(null)
      }
      return
    }

    let isMounted = true

    async function startCamera() {
      setCameraError(null)
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('La cámara en vivo no está disponible en este navegador.')
        }

        // Detener stream anterior si existe
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop())
          streamRef.current = null
        }

        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        }

        const newStream = await navigator.mediaDevices.getUserMedia(constraints)
        if (!isMounted) {
          newStream.getTracks().forEach((t) => t.stop())
          return
        }

        streamRef.current = newStream
        setStream(newStream)
        if (videoRef.current) {
          videoRef.current.srcObject = newStream
          await videoRef.current.play().catch(() => {})
        }

        // Verificar si soporta linterna / torch
        const track = newStream.getVideoTracks()[0]
        const capabilities = track.getCapabilities ? (track.getCapabilities() as Record<string, unknown>) : {}
        setHasTorch(Boolean(capabilities.torch))
      } catch (err) {
        if (isMounted) {
          const msg =
            err instanceof Error
              ? err.message
              : 'No se pudo acceder a la cámara. Revisa los permisos de tu navegador.'
          setCameraError(msg)
        }
      }
    }

    void startCamera()

    return () => {
      isMounted = false
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [isOpen, facingMode])

  // Encender / apagar linterna si el hardware lo soporta
  const toggleTorch = async () => {
    if (!stream || !hasTorch) return
    const track = stream.getVideoTracks()[0]
    try {
      const nextTorch = !isTorchOn
      await (track as unknown as { applyConstraints: (c: Record<string, unknown>) => Promise<void> }).applyConstraints({
        advanced: [{ torch: nextTorch }],
      })
      setIsTorchOn(nextTorch)
    } catch {
      // Ignorar fallo de linterna
    }
  }

  // Cambiar entre cámara trasera y frontal
  const switchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
    setIsTorchOn(false)
  }

  // Capturar frame de video
  const handleShutter = async () => {
    if (!videoRef.current || isCapturing) return
    setIsCapturing(true)

    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.(40)
      }

      const video = videoRef.current
      const width = video.videoWidth || 1280
      const height = video.videoHeight || 720

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('No se pudo inicializar canvas')

      // Si es cámara frontal, invertir horizontalmente para aspecto espejo natural
      if (facingMode === 'user') {
        ctx.translate(width, 0)
        ctx.scale(-1, 1)
      }

      ctx.drawImage(video, 0, 0, width, height)

      // Evaluación de calidad en caliente
      const imgData = ctx.getImageData(0, 0, Math.min(width, 400), Math.min(height, 300))
      const diag = evaluarBufferImagen({
        width: Math.min(width, 400),
        height: Math.min(height, 300),
        data: imgData.data,
      })
      setLiveQuality(diag)

      // Obtener geolocalización en paralelo
      let coords: { latitud: number | null; longitud: number | null; precision: number | null } = {
        latitud: null,
        longitud: null,
        precision: null,
      }

      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) => {
            navigator.geolocation.getCurrentPosition(res, rej, {
              enableHighAccuracy: true,
              timeout: 4000,
              maximumAge: 60000,
            })
          })
          coords = {
            latitud: pos.coords.latitude,
            longitud: pos.coords.longitude,
            precision: Math.round(pos.coords.accuracy * 10) / 10,
          }
        } catch {
          // Si el usuario denegó GPS o falló timeout, se conserva null sin bloquear
        }
      }

      // Convertir canvas a archivo Blob/File
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, 'image/jpeg', 0.92)
      )

      if (!blob) throw new Error('Error al generar fotografía')

      const rawFile = new File([blob], `foto-obra-${Date.now()}.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      })

      // Comprimir con la utilidad del proyecto
      const finalFile = await comprimirImagenEnCliente(rawFile, 1600, 0.82)

      onCapture(finalFile, {
        latitud: coords.latitud,
        longitud: coords.longitud,
        precision: coords.precision,
        resolucion: `${width}x${height}`,
        calidadScore: diag.score,
      })

      onClose()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al capturar la fotografía.')
    } finally {
      setIsCapturing(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-navy rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[96vh]">
        {/* Barra superior de cámara */}
        <div className="flex items-center justify-between px-4 py-3 bg-navy-dark text-white border-b border-white/10 z-10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
            <h3 className="text-sm font-semibold tracking-wide">{title}</h3>
          </div>

          <div className="flex items-center gap-2">
            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`p-2 rounded-lg text-xs font-semibold border transition-colors ${
                  isTorchOn
                    ? 'bg-amber-400 text-slate-900 border-amber-300'
                    : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                }`}
                title="Linterna / Flash"
              >
                {isTorchOn ? 'Flash ON' : 'Flash'}
              </button>
            )}

            <button
              type="button"
              onClick={switchCamera}
              className="p-2 rounded-lg text-xs font-semibold bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-colors"
              title="Girar cámara"
            >
              {facingMode === 'environment' ? 'Frontal' : 'Trasera'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors ml-1"
              aria-label="Cerrar visor"
            >
              <IconCerrar className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Visor de Video */}
        <div className="relative flex-1 bg-black min-h-[360px] flex items-center justify-center overflow-hidden">
          {cameraError ? (
            <div className="p-6 text-center text-white space-y-3">
              <p className="text-red-400 font-semibold text-sm">No se pudo abrir la cámara</p>
              <p className="text-xs text-gray-300 max-w-xs mx-auto">{cameraError}</p>
              <p className="text-xs text-gray-400">
                Puedes usar el botón estándar de subir archivo con la cámara nativa del sistema.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary text-xs px-4 py-2 mt-2"
              >
                Cerrar y usar selector nativo
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Guía visual para enfocar etiqueta o remisión */}
              <div className="absolute inset-8 sm:inset-12 border-2 border-dashed border-teal-400/60 rounded-xl pointer-events-none flex flex-col justify-between p-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-teal-300 bg-black/60 px-2 py-0.5 rounded self-start">
                  Enfoca el material o etiqueta
                </span>
                <span className="text-[10px] font-mono text-gray-300 bg-black/60 px-2 py-0.5 rounded self-end">
                  {facingMode === 'environment' ? 'Trasera (Obra)' : 'Frontal'}
                </span>
              </div>

              {/* Diagnóstico si se detecta advertencia */}
              {liveQuality && !liveQuality.esApta && (
                <div className="absolute top-3 inset-x-3 bg-amber-900/90 text-amber-100 text-xs px-3 py-1.5 rounded-lg border border-amber-500/50 backdrop-blur-xs">
                  {liveQuality.mensajes[0]}
                </div>
              )}
            </>
          )}
        </div>

        {/* Barra inferior de Disparo */}
        {!cameraError && (
          <div className="p-4 bg-navy-dark border-t border-white/10 flex items-center justify-center gap-4">
            <button
              type="button"
              disabled={isCapturing}
              onClick={handleShutter}
              className="w-16 h-16 rounded-full border-4 border-white bg-teal-500 hover:bg-teal-400 active:scale-95 transition-all shadow-lg flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-teal-400/50 disabled:opacity-50"
              aria-label="Tomar fotografía"
            >
              <div className="w-11 h-11 rounded-full bg-white/90" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
