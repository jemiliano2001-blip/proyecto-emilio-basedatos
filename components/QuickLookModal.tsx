'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import { IconCerrar, IconExterno, IconChevron } from '@/components/icons'
import { useModalFocus } from '@/lib/hooks/useModalFocus'

export interface QuickLookItem {
  url: string
  nombre: string
  tipo?: 'pdf' | 'imagen' | 'otro'
  tamano?: string | null
  subidoPor?: string | null
  fecha?: string | null
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
  const panelRef = useRef<HTMLDivElement>(null)
  useModalFocus(open, panelRef)

  useEffect(() => {
    setCurrentIndex(initialIndex)
    setZoomNivel(1)
  }, [initialIndex, open])

  const itemActual = items[currentIndex] ?? null

  const handleNext = useCallback(() => {
    if (items.length > 1) {
      setCurrentIndex((prev) => (prev + 1) % items.length)
      setZoomNivel(1)
    }
  }, [items.length])

  const handlePrev = useCallback(() => {
    if (items.length > 1) {
      setCurrentIndex((prev) => (prev - 1 + items.length) % items.length)
      setZoomNivel(1)
    }
  }, [items.length])

  // Atajos de teclado: Escape (cerrar), Flecha Izq/Der (navegar), Espacio (cerrar)
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleNext()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handlePrev()
      } else if (e.key === ' ' && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLAnchorElement)) {
        e.preventDefault()
        onClose()
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

  const esImagen =
    itemActual.tipo === 'imagen' ||
    Boolean(urlStr.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i)) ||
    Boolean(nombreStr.match(/\.(jpeg|jpg|gif|png|webp)$/i))

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quicklook-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-foreground/80 backdrop-blur-md transition-opacity print:hidden"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative flex flex-col w-full max-w-5xl h-[92vh] max-h-[900px] bg-card rounded-2xl shadow-2xl border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra superior de herramientas */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50 shrink-0">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <span
              className={`px-2 py-0.5 text-xs font-bold rounded ${
                esPdf
                  ? 'bg-danger-soft text-danger-soft-foreground'
                  : esImagen
                  ? 'bg-primary-soft text-primary-soft-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {esPdf ? 'PDF' : esImagen ? 'FOTO' : 'ARCHIVO'}
            </span>
            <div className="min-w-0">
              <h2
                id="quicklook-title"
                className="text-sm font-bold text-foreground truncate max-w-[280px] sm:max-w-md md:max-w-lg"
                title={itemActual.nombre}
              >
                {itemActual.nombre}
              </h2>
              {(itemActual.tamano || itemActual.fecha || itemActual.subidoPor) && (
                <p className="text-[11px] text-muted-foreground truncate">
                  {[itemActual.tamano, itemActual.fecha, itemActual.subidoPor]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Controles para imagen: zoom */}
            {esImagen && (
              <div className="hidden sm:flex items-center gap-1 mr-2 px-1.5 py-0.5 bg-muted/80 border border-border/60 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setZoomNivel((z) => Math.max(0.5, z - 0.25))}
                  className="flex h-7 w-7 items-center justify-center rounded-md font-bold text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                  aria-label="Reducir zoom"
                  title="Reducir zoom"
                >
                  <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
                <span className="tabular-nums font-semibold text-foreground px-1.5 text-[11px]">
                  {Math.round(zoomNivel * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomNivel((z) => Math.min(3, z + 0.25))}
                  className="flex h-7 w-7 items-center justify-center rounded-md font-bold text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                  aria-label="Aumentar zoom"
                  title="Aumentar zoom"
                >
                  <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
                {zoomNivel !== 1 && (
                  <button
                    type="button"
                    onClick={() => setZoomNivel(1)}
                    className="ml-1 px-1.5 py-0.5 text-[11px] font-medium text-primary hover:text-primary-hover hover:underline"
                  >
                    Restablecer
                  </button>
                )}
              </div>
            )}

            {/* Botón de descarga directa */}
            <a
              href={itemActual.url}
              download={itemActual.nombre}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary btn-sm font-medium"
              title="Descargar o abrir en pestaña externa"
            >
              <span>Descargar</span>
              <IconExterno className="size-3.5" />
            </a>

            {/* Botón de cierre */}
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors ml-1 p-1.5 flex items-center justify-center"
              aria-label="Cerrar vista previa (Esc)"
              title="Cerrar vista previa (Esc)"
            >
              <IconCerrar className="w-5 h-5" />
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
            <div className="w-full h-full flex items-center justify-center overflow-auto">
              <div
                style={{
                  transform: `scale(${zoomNivel})`,
                  transformOrigin: 'center center',
                  transition: 'transform 150ms ease-out',
                }}
                className="max-w-full max-h-full flex items-center justify-center"
              >
                {/* Visualizador de imagen de alta fidelidad */}
                <Image
                  src={itemActual.url}
                  alt={itemActual.nombre}
                  width={1400}
                  height={1000}
                  unoptimized
                  className="max-h-[75vh] w-auto h-auto object-contain rounded-lg shadow-md"
                />
              </div>
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
                className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center bg-card/90 hover:bg-card text-foreground rounded-full shadow-card hover:shadow-card-hover border border-border/80 transition-all active:scale-95 backdrop-blur-sm"
                title="Elemento anterior (←)"
                aria-label="Elemento anterior"
              >
                <IconChevron className="size-5 rotate-180" />
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center bg-card/90 hover:bg-card text-foreground rounded-full shadow-card hover:shadow-card-hover border border-border/80 transition-all active:scale-95 backdrop-blur-sm"
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
