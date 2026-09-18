'use client'

import React, { useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { IconCerrar, IconEditar, IconPaquete } from '@/components/icons'
import { Badge } from '@/components/Badge'
import { formatMoneyMx } from '@/lib/money'
import type { CatalogoMaterial } from '@/lib/types'
import { useModalFocus } from '@/lib/hooks/useModalFocus'

interface MaterialPreviewModalProps {
  material: CatalogoMaterial | null
  open: boolean
  onClose: () => void
  puedeEditar?: boolean
  verPrecios?: boolean
}

export function MaterialPreviewModal({
  material,
  open,
  onClose,
  puedeEditar = false,
  verPrecios = false,
}: MaterialPreviewModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useModalFocus(open, dialogRef)

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open])

  if (!open || !material) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="material-preview-title"
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-foreground/75 backdrop-blur-sm transition-opacity print:hidden"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative flex h-full w-full max-w-lg flex-col overflow-hidden border-l border-border bg-card shadow-2xl animate-slide-in-right sm:rounded-l-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera con categorías y botón cerrar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/40 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            {material.categoria && (
              <Badge variant="teal">{material.categoria}</Badge>
            )}
            {material.subcategoria && (
              <Badge variant="gray">{material.subcategoria}</Badge>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
            aria-label="Cerrar ficha de material"
          >
            <IconCerrar className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido con scroll */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Fotografía principal en grande */}
          <div className="w-full aspect-video sm:aspect-[4/3] bg-muted rounded-xl overflow-hidden border border-border flex items-center justify-center relative">
            {material.foto_url ? (
              <Image
                src={material.foto_url}
                alt={material.nombre_base}
                width={800}
                height={600}
                unoptimized
                className="w-full h-full object-contain bg-muted/30"
              />
            ) : (
              <div className="text-center p-6 text-muted-foreground">
                <IconPaquete className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-medium">Sin fotografía asignada en catálogo</p>
              </div>
            )}
          </div>

          {/* Título y Unidad */}
          <div>
            <h2
              id="material-preview-title"
              className="text-lg font-bold text-foreground leading-tight"
            >
              {material.nombre_base}
            </h2>
            {material.variante && (
              <p className="text-sm font-medium text-muted-foreground mt-0.5">
                Variante: {material.variante}
              </p>
            )}
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-muted text-foreground font-semibold">
                Unidad: {material.unidad_medida}
              </span>
              {verPrecios && material.precio_base !== undefined && material.precio_base > 0 && (
                <span className="font-semibold text-primary text-sm tabular-nums">
                  Precio base ref.: {formatMoneyMx(material.precio_base)}
                </span>
              )}
            </div>
          </div>

          {/* Especificaciones técnicas */}
          <div className="p-3.5 bg-muted/40 rounded-xl border border-border">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Especificaciones y Normas
            </h3>
            {material.especificacion ? (
              <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                {material.especificacion}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Sin especificaciones técnicas adicionales registradas para este material.
              </p>
            )}
          </div>
        </div>

        {/* Pie de acciones */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/40 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary btn-sm"
          >
            Cerrar
          </button>
          {puedeEditar && (
            <Link
              href={`/materiales/${material.id}`}
              className="btn-primary text-sm px-3.5 py-2"
            >
              <IconEditar className="w-3.5 h-3.5" />
              <span>Editar material</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
