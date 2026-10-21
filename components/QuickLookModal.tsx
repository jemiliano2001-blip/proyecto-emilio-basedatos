'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { IconCerrar, IconExterno, IconChevron } from '@/components/icons'
import { SIN_DATO } from '@/lib/fechas'
import { useModalFocus } from '@/lib/hooks/useModalFocus'
import { detectarTipoArchivo } from '@/lib/preview-helpers'

export interface QuickLookItem {
  url: string
  nombre: string
  tipo?: 'pdf' | 'imagen' | 'otro'
  tamano?: string | null
  subidoPor?: string | null
  fecha?: string | null
  proveedor?: string | null
  folio?: string | null
  monto?: string | null
  moneda?: string | null
}

interface QuickLookModalProps {
  items: QuickLookItem[]
  initialIndex?: number
  open: boolean
  onClose: () => void
}

export function QuickLookModal({
  items,
  initialIndex = 0,
  open,
  onClose,
}: QuickLookModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [zoomNivel, setZoomNivel] = useState(1)
  const [rotacion, setRotacion] = useState(0)
  const [posicion, setPosicion] = useState({ x: 0, y: 0 })
  const [arrastrando, setArrastrando] = useState(false)
  const [puntoInicio, setPuntoInicio] = useState({ x: 0, y: 0 })
  const panelRef = useRef<HTMLDivElement>(null)
  useModalFocus(open, panelRef)

  const restablecerVista = useCallback(() => {
    setZoomNivel(1)
    setRotacion(0)
    setPosicion({ x: 0, y: 0 })
    setArrastrando(false)
  }, [])

  useEffect(() => {
    setCurrentIndex(initialIndex)
    restablecerVista()
  }, [initialIndex, open, restablecerVista])

  const itemActual = items[currentIndex] ?? null

  const handleNext = useCallback(() => {
    if (items.length > 1) {
      setCurrentIndex((prev) => (prev + 1) % items.length)
      restablecerVista()
    }
  }, [items.length, restablecerVista])

  const handlePrev = useCallback(() => {
    if (items.length > 1) {
      setCurrentIndex((prev) => (prev - 1 + items.length) % items.length)
      restablecerVista()
    }
  }, [items.length, restablecerVista])

  // Atajos de teclado: Escape (cerrar), Flecha Izq/Der (navegar), Espacio (cerrar)
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase()
      const esInput = tag === 'input' || tag === 'textarea' || tag === 'select'
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowRight' && !esInput) {
        e.preventDefault()
        handleNext()
      } else if (e.key === 'ArrowLeft' && !esInput) {
        e.preventDefault()
        handlePrev()
      } else if (e.key === ' ' && !esInput && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLAnchorElement)) {
        e.preventDefault()
        onClose()
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        setZoomNivel((z) => Math.min(4, z + 0.25))
      } else if (e.key === '-') {
        e.preventDefault()
        setZoomNivel((z) => Math.max(0.5, z - 0.25))
      } else if (e.key === '0') {
        e.preventDefault()
        setZoomNivel(1)
        setPosicion({ x: 0, y: 0 })
      } else if (e.key.toLowerCase() === 'r' && !esInput) {
        e.preventDefault()
        setRotacion((r) => (r + 90) % 360)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose, handleNext, handlePrev])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open || !itemActual) return null

  const urlStr = itemActual.url || ''
  const nombreStr = itemActual.nombre || ''

  const esPdf =
    itemActual.tipo === 'pdf' ||
    urlStr.toLowerCase().endsWith('.pdf') ||
    urlStr.includes('.pdf?') ||
    nombreStr.toLowerCase().endsWith('.pdf')

  const detectado = detectarTipoArchivo(nombreStr || urlStr)
  const esImagen =
    itemActual.tipo === 'imagen' ||
    detectado === 'image' ||
    Boolean(urlStr.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i)) ||
    Boolean(nombreStr.match(/\.(jpeg|jpg|gif|png|webp)$/i))
  const muestraFicha =
    itemActual.proveedor !== undefined ||
    itemActual.folio !== undefined ||
    itemActual.monto !== undefined
  const montoTexto = itemActual.monto?.trim()
    ? itemActual.moneda && !itemActual.monto.toUpperCase().includes(itemActual.moneda.toUpperCase())
      ? `${itemActual.monto.trim()} ${itemActual.moneda}`
      : itemActual.monto.trim()
    : SIN_DATO

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quicklook-title"
      className="fixed inset-0 z-50 flex bg-foreground/80 transition-opacity print:hidden"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative flex flex-col w-full h-full max-w-none bg-card shadow-2xl border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra superior de herramientas */}
        <header className="flex flex-col gap-3 px-4 py-3 border-b border-border bg-muted/50 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`px-2 py-0.5 text-xs font-bold rounded ${
                    esPdf
                      ? 'bg-danger-soft text-danger-soft-foreground'
                      : esImagen
                      ? 'bg-primary-soft text-primary-soft-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {esPdf ? 'PDF' : esImagen ? 'IMG' : 'ARCHIVO'}
                </span>
                <h2
                  id="quicklook-title"
                  className="text-sm font-bold text-foreground truncate"
                  title={muestraFicha ? (itemActual.proveedor?.trim() || SIN_DATO) : itemActual.nombre}
                >
                  {muestraFicha ? (itemActual.proveedor?.trim() || SIN_DATO) : itemActual.nombre}
                </h2>
              </div>
              {muestraFicha ? (
                <p className="mt-1 text-xs text-muted-foreground truncate">
                  Folio {itemActual.folio?.trim() || SIN_DATO}
                  {' · '}
                  {montoTexto}
                </p>
              ) : (
                (itemActual.tamano || itemActual.fecha || itemActual.subidoPor) && (
                  <p className="mt-1 text-[11px] text-muted-foreground truncate">
                    {[itemActual.tamano, itemActual.fecha, itemActual.subidoPor]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Controles para imagen: zoom */}
            {esImagen && (
              <div className="flex flex-wrap items-center gap-1 mr-1 text-xs">
                <button
                  type="button"
                  onClick={() => setZoomNivel((z) => Math.max(0.5, z - 0.25))}
                  className="btn-secondary min-h-11 px-3"
                  aria-label="Alejar"
                >
                  Alejar
                </button>
                <span className="tabular-nums font-semibold text-foreground px-1.5 text-xs">
                  {Math.round(zoomNivel * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomNivel((z) => Math.min(4, z + 0.25))}
                  className="btn-secondary min-h-11 px-3"
                  aria-label="Acercar"
                >
                  Acercar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoomNivel(1)
                    setPosicion({ x: 0, y: 0 })
                  }}
                  className="btn-secondary min-h-11 px-3"
                >
                  Ajustar
                </button>
                <button
                  type="button"
                  onClick={() => setRotacion((r) => (r + 90) % 360)}
                  className="btn-secondary min-h-11 px-3"
                >
                  Girar
                </button>
              </div>
            )}

            {/* Botón de descarga directa */}
            <a
              href={itemActual.url}
              download={itemActual.nombre}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary min-h-11 px-3 font-medium"
              title="Descargar o abrir en pestaña externa"
            >
              <span>Descargar</span>
              <IconExterno className="size-3.5" />
            </a>

            {/* Botón de cierre */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar vista previa"
              title="Cerrar vista previa (Esc)"
              className="btn-secondary min-h-11 px-3"
            >
              <IconCerrar className="w-5 h-5" />
              <span>Cerrar</span>
            </button>
          </div>
        </header>

        {/* Contenedor central de visualización */}
        <div className="relative flex-1 bg-muted/40 overflow-auto flex items-center justify-center p-2 sm:p-4">
          {esPdf ? (
            <div className="w-full h-full rounded-lg overflow-hidden bg-card shadow-inner border border-border">
              <iframe
                src={`${itemActual.url}#toolbar=1&navpanes=0`}
                title={itemActual.nombre}
                className="w-full h-full border-0"
              />
            </div>
          ) : esImagen ? (
            <div
              className="w-full h-full flex items-center justify-center overflow-hidden"
              onWheel={(evento) => {
                evento.preventDefault()
                const delta = evento.deltaY * -0.0015
                setZoomNivel((prev) => Math.min(Math.max(prev + delta, 0.5), 4))
              }}
              onPointerDown={(evento) => {
                if (zoomNivel <= 1 || evento.button !== 0) return
                evento.currentTarget.setPointerCapture(evento.pointerId)
                setArrastrando(true)
                setPuntoInicio({ x: evento.clientX - posicion.x, y: evento.clientY - posicion.y })
              }}
              onPointerMove={(evento) => {
                if (!arrastrando) return
                setPosicion({
                  x: evento.clientX - puntoInicio.x,
                  y: evento.clientY - puntoInicio.y,
                })
              }}
              onPointerUp={() => setArrastrando(false)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- zoom, giro y blob: no pasan por el optimizador */}
              <img
                src={itemActual.url}
                alt={itemActual.nombre}
                draggable={false}
                style={{
                  transform: `translate(${posicion.x}px, ${posicion.y}px) scale(${zoomNivel}) rotate(${rotacion}deg)`,
                  cursor: zoomNivel > 1 ? (arrastrando ? 'grabbing' : 'grab') : 'default',
                  transition: arrastrando ? 'none' : 'transform 150ms ease-out',
                }}
                className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-md"
              />
            </div>
          ) : (
            <div className="text-center p-6 bg-card rounded-xl shadow-sm border border-border max-w-md">
              <p className="text-sm font-semibold text-foreground mb-1">
                Visualización previa no disponible directamente
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                El tipo de archivo no puede renderizarse en este navegador. Puedes descargarlo para inspeccionarlo en tu equipo.
              </p>
              <a
                href={itemActual.url}
                download={itemActual.nombre}
                className="btn-primary text-xs"
              >
                Descargar archivo
              </a>
            </div>
          )}

          {/* Flechas de navegación secuencial si hay múltiples elementos */}
          {items.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrev}
                className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center bg-card/90 hover:bg-card text-foreground rounded-full shadow-card hover:shadow-card-hover border border-border/80 transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-95"
                title="Elemento anterior (←)"
                aria-label="Elemento anterior"
              >
                <IconChevron className="size-5 rotate-180" />
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center bg-card/90 hover:bg-card text-foreground rounded-full shadow-card hover:shadow-card-hover border border-border/80 transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-95"
                title="Elemento siguiente (→)"
                aria-label="Elemento siguiente"
              >
                <IconChevron className="size-5" />
              </button>
            </>
          )}
        </div>

        {/* Pie de navegación de carrusel */}
        {items.length > 1 && (
          <footer className="px-4 py-2 border-t border-border bg-card flex items-center justify-between text-xs text-muted-foreground shrink-0">
            <span className="tabular-nums">
              Documento {currentIndex + 1} de {items.length}
            </span>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border font-mono">←</kbd>
              <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border font-mono">→</kbd>
              <span>para navegar</span>
            </div>
          </footer>
        )}
      </div>
    </div>
  )
}
