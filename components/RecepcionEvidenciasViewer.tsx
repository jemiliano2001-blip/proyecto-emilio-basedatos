'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { QuickLookModal, type QuickLookItem } from '@/components/QuickLookModal'
import type { RecepcionFoto } from '@/lib/types'

interface RecepcionEvidenciasViewerProps {
  fotoRemisionUrl?: string | null
  fotoEvidenciaUrl?: string | null
  fotos?: RecepcionFoto[]
  folioOrden: string
}

function formatearTipoFoto(tipo: string): { label: string; bg: string; text: string } {
  switch (tipo) {
    case 'remision_documento':
      return { label: 'REMISIÓN / GUÍA', bg: 'bg-amber-100', text: 'text-amber-800' }
    case 'dano_evidencia':
      return { label: 'DAÑO REPORTADO', bg: 'bg-red-100', text: 'text-red-800' }
    case 'etiqueta_placa':
      return { label: 'PLACA / SERIE', bg: 'bg-purple-100', text: 'text-purple-800' }
    case 'firma_chofer':
      return { label: 'FIRMA CHOFER', bg: 'bg-blue-100', text: 'text-blue-800' }
    case 'selfie_entrega':
      return { label: 'SELFIE ENTREGA', bg: 'bg-emerald-100', text: 'text-emerald-800' }
    default:
      return { label: 'MATERIAL EN OBRA', bg: 'bg-teal-100', text: 'text-teal-800' }
  }
}

export function RecepcionEvidenciasViewer({
  fotoRemisionUrl,
  fotoEvidenciaUrl,
  fotos = [],
  folioOrden,
}: RecepcionEvidenciasViewerProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [initialIndex, setInitialIndex] = useState(0)

  const items: QuickLookItem[] = []

  // Incorporar fotos del array estructurado
  if (fotos.length > 0) {
    for (const f of fotos) {
      items.push({
        url: f.foto_url,
        nombre: `Evidencia OC ${folioOrden} · ${f.tipo_foto.replace('_', ' ')}`,
        tipo: 'imagen',
      })
    }
  } else {
    // Fallback a campos legacy si no hay registros en recepcion_fotos
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
        {fotos.length > 0
          ? fotos.map((f, idx) => {
              const badge = formatearTipoFoto(f.tipo_foto)
              return (
                <div
                  key={f.id || idx}
                  onClick={() => handleOpen(idx)}
                  className="card p-3 flex items-center gap-3 cursor-pointer hover:border-teal-300 hover:bg-teal-50/20 transition-all group"
                >
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 shrink-0 relative">
                    <Image
                      src={f.foto_url}
                      alt="Evidencia fotográfica"
                      width={64}
                      height={64}
                      unoptimized
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                      {f.calidad_score != null && (
                        <span className="text-[10px] text-gray-500 font-mono">
                          {Math.round(Number(f.calidad_score) * 100)}% calidad
                        </span>
                      )}
                    </div>
                    {f.latitud != null && (
                      <p className="text-[10px] text-gray-500 font-mono mt-1 truncate">
                        📍 {Number(f.latitud).toFixed(4)}, {Number(f.longitud).toFixed(4)}
                        {f.precision_gps_m && ` (±${f.precision_gps_m}m)`}
                      </p>
                    )}
                    <p className="text-[11px] text-accent group-hover:underline mt-0.5">
                      Ver en grande ↗
                    </p>
                  </div>
                </div>
              )
            })
          : items.map((item, idx) => (
              <div
                key={idx}
                onClick={() => handleOpen(idx)}
                className="card p-3 flex items-center gap-3 cursor-pointer hover:border-teal-300 hover:bg-teal-50/20 transition-all group"
              >
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 shrink-0 relative">
                  <Image
                    src={item.url}
                    alt={item.nombre}
                    width={64}
                    height={64}
                    unoptimized
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-100 text-teal-800">
                    EVIDENCIA ADJUNTA
                  </span>
                  <p className="text-xs font-semibold text-ink mt-1 truncate">
                    {item.nombre}
                  </p>
                  <p className="text-[11px] text-accent group-hover:underline mt-0.5">
                    Ver en grande ↗
                  </p>
                </div>
              </div>
            ))}
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
