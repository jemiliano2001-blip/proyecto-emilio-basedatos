'use client'

import { IconExterno, IconUbicacion } from '@/components/icons'

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
      return { label: 'REMISIÓN / GUÍA', bg: 'bg-warning-soft', text: 'text-warning-soft-foreground' }
    case 'dano_evidencia':
      return { label: 'DAÑO REPORTADO', bg: 'bg-danger-soft', text: 'text-danger-soft-foreground' }
    case 'etiqueta_placa':
      return { label: 'PLACA / SERIE', bg: 'bg-info-soft', text: 'text-info-soft-foreground' }
    case 'firma_chofer':
      return { label: 'FIRMA CHOFER', bg: 'bg-info-soft', text: 'text-info-soft-foreground' }
    case 'selfie_entrega':
      return { label: 'SELFIE ENTREGA', bg: 'bg-success-soft', text: 'text-success-soft-foreground' }
    default:
      return { label: 'MATERIAL EN OBRA', bg: 'bg-primary-soft', text: 'text-primary-soft-foreground' }
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
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
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
                  className="card p-3 flex items-center gap-3 cursor-pointer hover:border-primary/40 hover:bg-primary-soft/20 transition-all group"
                >
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted border border-border shrink-0 relative">
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
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {Math.round(Number(f.calidad_score) * 100)}% calidad
                        </span>
                      )}
                    </div>
                    {f.latitud != null && (
                      <p className="mt-1 flex items-center gap-1 truncate font-mono text-[10px] text-muted-foreground">
                        <IconUbicacion className="size-3 shrink-0" />
                        {Number(f.latitud).toFixed(4)}, {Number(f.longitud).toFixed(4)}
                        {f.precision_gps_m && ` (±${f.precision_gps_m}m)`}
                      </p>
                    )}
                    <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-primary group-hover:underline">
                      Ver en grande <IconExterno className="size-3" />
                    </p>
                  </div>
                </div>
              )
            })
          : items.map((item, idx) => (
              <div
                key={idx}
                onClick={() => handleOpen(idx)}
                className="card p-3 flex items-center gap-3 cursor-pointer hover:border-primary/40 hover:bg-primary-soft/20 transition-all group"
              >
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted border border-border shrink-0 relative">
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
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary-soft text-primary-soft-foreground">
                    EVIDENCIA ADJUNTA
                  </span>
                  <p className="text-xs font-semibold text-foreground mt-1 truncate">
                    {item.nombre}
                  </p>
                  <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-primary group-hover:underline">
                    Ver en grande <IconExterno className="size-3" />
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
