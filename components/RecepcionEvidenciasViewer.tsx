'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { QuickLookModal, type QuickLookItem } from '@/components/QuickLookModal'

interface RecepcionEvidenciasViewerProps {
  fotoRemisionUrl?: string | null
  fotoEvidenciaUrl?: string | null
  folioOrden: string
}

export function RecepcionEvidenciasViewer({
  fotoRemisionUrl,
  fotoEvidenciaUrl,
  folioOrden,
}: RecepcionEvidenciasViewerProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [initialIndex, setInitialIndex] = useState(0)

  const items: QuickLookItem[] = []
  if (fotoRemisionUrl) {
    items.push({
      url: fotoRemisionUrl,
      nombre: `Remisión física - OC ${folioOrden}`,
      tipo: 'imagen',
    })
  }
  if (fotoEvidenciaUrl) {
    items.push({
      url: fotoEvidenciaUrl,
      nombre: `Evidencia de entrega / material - OC ${folioOrden}`,
      tipo: 'imagen',
    })
  }

  if (items.length === 0) return null

  const handleOpen = (idx: number) => {
    setInitialIndex(idx)
    setModalOpen(true)
  }

  return (
    <section className="mb-4">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Evidencias Fotográficas Adjuntas ({items.length})
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fotoRemisionUrl && (
          <div
            onClick={() => handleOpen(0)}
            className="card p-3 flex items-center gap-3 cursor-pointer hover:border-teal-300 hover:bg-teal-50/20 transition-all group"
          >
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 shrink-0 relative">
              <Image
                src={fotoRemisionUrl}
                alt="Remisión física"
                width={64}
                height={64}
                unoptimized
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                REMISIÓN / GUÍA
              </span>
              <p className="text-xs font-semibold text-ink mt-1 truncate">
                Documento de entrega firmado
              </p>
              <p className="text-[11px] text-accent group-hover:underline mt-0.5">
                Ver en grande ↗
              </p>
            </div>
          </div>
        )}

        {fotoEvidenciaUrl && (
          <div
            onClick={() => handleOpen(fotoRemisionUrl ? 1 : 0)}
            className="card p-3 flex items-center gap-3 cursor-pointer hover:border-teal-300 hover:bg-teal-50/20 transition-all group"
          >
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 shrink-0 relative">
              <Image
                src={fotoEvidenciaUrl}
                alt="Evidencia física"
                width={64}
                height={64}
                unoptimized
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-100 text-teal-800">
                EVIDENCIA FÍSICA
              </span>
              <p className="text-xs font-semibold text-ink mt-1 truncate">
                Descarga en obra / Daños
              </p>
              <p className="text-[11px] text-accent group-hover:underline mt-0.5">
                Ver en grande ↗
              </p>
            </div>
          </div>
        )}
      </div>

      <QuickLookModal
        items={items}
        initialIndex={initialIndex}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </section>
  )
}
