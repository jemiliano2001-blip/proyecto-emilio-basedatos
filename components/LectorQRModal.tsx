'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { IconCerrar, IconCamara } from '@/components/icons'
import { vibrarExito, vibrarAlerta } from '@/lib/haptics'

interface Props {
  isOpen: boolean
  onClose: () => void
  titulo?: string
  subtitulo?: string
}

/** Reproduce un bip suave sintetizado usando Web Audio API */
function reproducirBipExito() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime) // Nota A5
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12) // Sube a E6

    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start()
    osc.stop(ctx.currentTime + 0.15)
  } catch {
    // Ignorar si el audio context está bloqueado por política de usuario
  }
}

export function LectorQRModal({
  isOpen,
  onClose,
  titulo = 'Escanear Código QR',
  subtitulo = 'Apunta la cámara al código impreso de la Orden de Compra',
}: Props) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const [errorCamara, setErrorCamara] = useState<string | null>(null)
  const [iniciando, setIniciando] = useState(true)
  const [escaneando, setEscaneando] = useState(true)

  const detenerCamara = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  const handleCodigoDetectado = useCallback((rawTexto: string) => {
    setEscaneando(false)
    reproducirBipExito()
    vibrarExito()
    detenerCamara()

    const texto = rawTexto.trim()

    // Caso 1: Prefijo de la aplicación "emilio:oc:{id}"
    if (texto.startsWith('emilio:oc:')) {
      const ordenId = texto.replace('emilio:oc:', '').trim()
      onClose()
      router.push(`/ordenes/${ordenId}/recibir`)
      return
    }

    // Caso 2: URL completa o relativa a una orden
    const urlMatch = texto.match(/\/ordenes\/([a-zA-Z0-9_-]+)/)
    if (urlMatch) {
      const ordenId = urlMatch[1]
      onClose()
      router.push(`/ordenes/${ordenId}/recibir`)
      return
    }

    // Caso 3: Folio o ID directo
    onClose()
    router.push(`/ordenes/${texto}/recibir`)
  }, [detenerCamara, onClose, router])

  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    if (!isOpen) {
      detenerCamara()
      return
    }

    setIniciando(true)
    setErrorCamara(null)
    setEscaneando(true)

    let activo = true

    async function iniciarCamara() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Tu navegador no permite acceso a la cámara.')
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })

        if (!activo) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        setIniciando(false)

        // Inicializar BarcodeDetector si está disponible en el navegador
        interface BarcodeDetectorType {
          detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>
        }

        const WindowWithBarcode = window as unknown as {
          BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorType
        }

        if (WindowWithBarcode.BarcodeDetector) {
          const detector = new WindowWithBarcode.BarcodeDetector({ formats: ['qr_code'] })

          const escanearFrame = async () => {
            if (!activo || !videoRef.current || videoRef.current.readyState < 2) {
              if (activo) animFrameRef.current = requestAnimationFrame(escanearFrame)
              return
            }

            try {
              const barcodes = await detector.detect(videoRef.current)
              if (barcodes.length > 0 && barcodes[0].rawValue) {
                handleCodigoDetectado(barcodes[0].rawValue)
                return
              }
            } catch {
              // Continuar escaneando si falla un frame
            }

            if (activo) {
              animFrameRef.current = requestAnimationFrame(escanearFrame)
            }
          }

          animFrameRef.current = requestAnimationFrame(escanearFrame)
        } else {
          // El navegador no soporta BarcodeDetector de forma nativa
          setErrorCamara(
            'Tu navegador no tiene soporte nativo para detección de QR en vivo. Puedes ingresar el folio manualmente.'
          )
        }
      } catch (err: unknown) {
        if (!activo) return
        vibrarAlerta()
        let mensaje = 'No se pudo acceder a la cámara.'
        if (err instanceof Error) {
          const lower = err.message.toLowerCase()
          if (err.name === 'NotAllowedError' || lower.includes('permission') || lower.includes('denied') || lower.includes('policy')) {
            mensaje = 'Permiso de cámara bloqueado o denegado. Haz clic en el ícono del candado o configuración del sitio (junto a la dirección web) y permite el acceso a la cámara.'
          } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            mensaje = 'No se encontró ninguna cámara disponible en este dispositivo.'
          } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            mensaje = 'La cámara está siendo utilizada por otra aplicación o pestaña.'
          } else {
            mensaje = err.message
          }
        }
        setErrorCamara(mensaje)
        setIniciando(false)
      }
    }

    iniciarCamara()

    return () => {
      activo = false
      detenerCamara()
    }
  }, [isOpen, retryCount, detenerCamara, handleCodigoDetectado])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-card border border-rule rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Cabecera */}
        <div className="p-4 border-b border-rule flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-2">
            <IconCamara className="w-5 h-5 text-primary" />
            <div>
              <h3 className="text-sm font-bold text-foreground">{titulo}</h3>
              <p className="text-xs text-muted-foreground">{subtitulo}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
            title="Cerrar lector"
          >
            <IconCerrar className="w-5 h-5" />
          </button>
        </div>

        {/* Visor de Cámara */}
        <div className="relative w-full aspect-square bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {/* Guía visual de encuadre */}
          {escaneando && !errorCamara && !iniciando && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 border-2 border-dashed border-teal-400/80 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-teal-400 -mt-1 -ml-1 rounded-tl-md" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-teal-400 -mt-1 -mr-1 rounded-tr-md" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-teal-400 -mb-1 -ml-1 rounded-bl-md" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-teal-400 -mb-1 -mr-1 rounded-br-md" />
                <div className="w-full h-0.5 bg-teal-400/60 absolute top-1/2 -translate-y-1/2 animate-pulse" />
              </div>
            </div>
          )}

          {iniciando && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80 bg-black/60">
              <div className="w-8 h-8 border-3 border-teal-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-medium">Iniciando cámara...</span>
            </div>
          )}

          {errorCamara && (
            <div className="absolute inset-0 p-6 flex flex-col items-center justify-center text-center gap-3 bg-black/90 text-white">
              <p className="text-xs text-rose-300 leading-relaxed max-w-xs">{errorCamara}</p>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setErrorCamara(null)
                    setIniciando(true)
                    setRetryCount((c) => c + 1)
                  }}
                  className="btn-primary text-xs px-4 py-1.5"
                >
                  Reintentar
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary text-xs px-4 py-1.5"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Pie informativo */}
        <div className="p-3 bg-muted/20 border-t border-rule flex items-center justify-between text-xs text-muted-foreground">
          <span>Enfoca el código de la orden de compra</span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
