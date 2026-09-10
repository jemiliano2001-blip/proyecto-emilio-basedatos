'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { IconCerrar, IconEditar, IconPaquete } from '@/components/icons'
import { Badge } from '@/components/Badge'
import { formatMoneyMx } from '@/lib/money'
import type { CatalogoMaterial } from '@/lib/types'

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
  if (!open || !material) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="material-preview-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm transition-opacity print:hidden"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera con categorías y botón cerrar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/80 shrink-0">
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
            className="p-1.5 text-gray-400 hover:text-ink rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Cerrar ficha de material"
          >
            <IconCerrar className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido con scroll */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Fotografía principal en grande */}
          <div className="w-full aspect-video sm:aspect-[4/3] bg-gray-100 rounded-xl overflow-hidden border border-gray-200 flex items-center justify-center relative">
            {material.foto_url ? (
              <Image
                src={material.foto_url}
                alt={material.nombre_base}
                width={800}
                height={600}
                unoptimized
                className="w-full h-full object-contain bg-slate-50"
              />
            ) : (
              <div className="text-center p-6 text-gray-400">
                <IconPaquete className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-medium">Sin fotografía asignada en catálogo</p>
              </div>
            )}
          </div>

          {/* Título y Unidad */}
          <div>
            <h2
              id="material-preview-title"
              className="text-lg font-bold text-ink leading-tight"
            >
              {material.nombre_base}
            </h2>
            {material.variante && (
              <p className="text-sm font-medium text-gray-600 mt-0.5">
                Variante: {material.variante}
              </p>
            )}
            <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-gray-700 font-semibold">
                Unidad: {material.unidad_medida}
              </span>
              {verPrecios && material.precio_base !== undefined && material.precio_base > 0 && (
                <span className="font-semibold text-accent text-sm tabular-nums">
                  Precio base ref.: {formatMoneyMx(material.precio_base)}
                </span>
              )}
            </div>
          </div>

          {/* Especificaciones técnicas */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Especificaciones y Normas
            </h3>
            {material.especificacion ? (
              <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                {material.especificacion}
              </p>
            ) : (
              <p className="text-xs text-gray-400 italic">
                Sin especificaciones técnicas adicionales registradas para este material.
              </p>
            )}
          </div>
        </div>

        {/* Pie de acciones */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-xs px-3 py-2"
          >
            Cerrar
          </button>
          {puedeEditar && (
            <Link
              href={`/materiales/${material.id}`}
              className="btn-primary text-xs px-3.5 py-2 inline-flex items-center gap-1.5"
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
