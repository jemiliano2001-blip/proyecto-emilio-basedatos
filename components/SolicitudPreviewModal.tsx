'use client'

import React, { useEffect, useRef } from 'react'
import { IconCerrar, IconAlerta, IconCheck } from '@/components/icons'
import { formatMoneyMx } from '@/lib/money'
import { labelTipoLinea } from '@/lib/validations/solicitud'
import type { TipoLineaSolicitud } from '@/lib/types'
import { useModalFocus } from '@/lib/hooks/useModalFocus'

export interface PreviewItemData {
  tipo_linea: TipoLineaSolicitud
  nombre: string
  variante?: string | null
  cantidad: number
  unidad_medida: string
  monto_mxn?: number | null
  nota?: string | null
  obraNombre?: string | null
  disponible?: number | null
}

interface SolicitudPreviewModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  obraNombrePrincipal: string
  notaGeneral?: string
  items: PreviewItemData[]
  isSubmitting?: boolean
  fecha?: string
  folio?: string
  ordenCompraFolio?: string
}

export function SolicitudPreviewModal({
  open,
  onClose,
  onConfirm,
  obraNombrePrincipal,
  notaGeneral,
  items,
  isSubmitting = false,
  fecha,
  folio,
  ordenCompraFolio,
}: SolicitudPreviewModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useModalFocus(open, dialogRef)

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSubmitting, onClose, open])

  if (!open) return null

  const displayFecha =
    fecha ||
    new Date().toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

  // Verificar si alguna partida tiene saldo insuficiente
  const itemsConAlerta = items.filter(
    (it) =>
      it.tipo_linea === 'material' &&
      it.disponible !== null &&
      it.disponible !== undefined &&
      it.cantidad > it.disponible
  )

  const tieneAlertas = itemsConAlerta.length > 0

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="solicitud-preview-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-sm transition-opacity print:hidden"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative flex flex-col w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado formal con metadatos destacados */}
        <header className="px-5 py-4 border-b border-gray-200 bg-slate-50/90 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-teal-100 text-teal-800">
                  VISTA PREVIA
                </span>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-200/80 text-navy border border-slate-300/60">
                  {folio ? `FOLIO: ${folio}` : 'FOLIO: REQ-NUEVA'}
                </span>
                {ordenCompraFolio && (
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-300">
                    OC: {ordenCompraFolio}
                  </span>
                )}
              </div>
              <h2
                id="solicitud-preview-title"
                className="text-base font-bold text-ink"
              >
                Solicitud para requisición de materiales
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mt-1">
                <p>
                  Proyecto: <strong className="text-ink font-semibold">{obraNombrePrincipal}</strong>
                </p>
                <span>·</span>
                <p>
                  Fecha: <strong className="text-gray-700 font-medium">{displayFecha}</strong>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center text-gray-400 hover:text-ink rounded-lg hover:bg-gray-200/80 transition-colors"
              aria-label="Cerrar vista previa"
            >
              <IconCerrar className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Alerta si hay saldo insuficiente */}
        {tieneAlertas && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-2.5 text-xs">
            <IconAlerta className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-bold">Advertencia de saldo insuficiente:</p>
              <p className="mt-0.5">
                {itemsConAlerta.length} partida(s) solicitan más material del disponible asignado. Compras deberá autorizar la excepción o ajustar el presupuesto.
              </p>
            </div>
          </div>
        )}

        {/* Nota general */}
        {notaGeneral && notaGeneral.trim() && (
          <div className="mx-5 mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200/80 text-xs">
            <p className="font-bold text-gray-500 uppercase tracking-wider text-[10px] mb-0.5">
              Nota general:
            </p>
            <p className="text-gray-700">{notaGeneral}</p>
          </div>
        )}

        {/* Lista de partidas */}
        <div className="p-5 overflow-y-auto space-y-2.5">
          <div className="flex items-center justify-between text-xs text-gray-500 pb-1 border-b border-gray-100 font-semibold uppercase tracking-wider">
            <span>Partidas a solicitar ({items.length})</span>
            <span>Cantidad / Monto</span>
          </div>

          {items.map((it, idx) => {
            const insuficiente =
              it.tipo_linea === 'material' &&
              it.disponible !== null &&
              it.disponible !== undefined &&
              it.cantidad > it.disponible

            return (
              <div
                key={idx}
                className={`p-3 rounded-xl border transition-colors ${
                  insuficiente
                    ? 'border-red-200 bg-red-50/40'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-gray-400 font-mono">
                        #{idx + 1}
                      </span>
                      <p className="text-sm font-semibold text-ink">
                        {it.nombre}
                      </p>
                      {it.variante && (
                        <span className="text-xs text-gray-500">· {it.variante}</span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                        {labelTipoLinea(it.tipo_linea)}
                      </span>
                    </div>

                    {it.obraNombre && it.obraNombre !== obraNombrePrincipal && (
                      <p className="text-xs font-semibold text-teal-700 mt-1">
                        Proyecto destino: {it.obraNombre}
                      </p>
                    )}

                    {it.nota && (
                      <p className="text-xs text-gray-500 mt-1 italic">
                        &quot;{it.nota}&quot;
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    {it.tipo_linea === 'material' ? (
                      <p className="text-sm font-bold text-ink tabular-nums">
                        {it.cantidad} {it.unidad_medida}
                      </p>
                    ) : (
                      it.monto_mxn != null && (
                        <p className="text-sm font-bold text-accent tabular-nums">
                          {formatMoneyMx(it.monto_mxn)}
                        </p>
                      )
                    )}

                    {it.tipo_linea === 'material' && it.disponible !== null && it.disponible !== undefined && (
                      <p
                        className={`text-[11px] tabular-nums mt-0.5 ${
                          insuficiente
                            ? 'text-red-600 font-semibold'
                            : 'text-gray-400'
                        }`}
                      >
                        Disponible: {it.disponible}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Pie de acciones */}
        <footer className="px-5 py-3.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between shrink-0 gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="btn-secondary text-sm px-3.5 py-2.5 min-h-[44px]"
          >
            Modificar partidas
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting || items.length === 0}
            className="btn-primary text-sm px-4 py-2.5 min-h-[44px] inline-flex items-center gap-1.5"
          >
            <IconCheck className="w-4 h-4" />
            <span>{isSubmitting ? 'Creando requisición…' : 'Confirmar y levantar'}</span>
          </button>
        </footer>
      </div>
    </div>
  )
}
