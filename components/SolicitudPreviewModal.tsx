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
  solicitanteNombre?: string | null
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
  solicitanteNombre,
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-foreground/80 backdrop-blur-sm transition-opacity print:hidden"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative flex flex-col w-full max-w-2xl bg-card rounded-2xl shadow-2xl border border-border overflow-hidden max-h-[92vh] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado formal con metadatos destacados */}
        <header className="px-5 py-4 border-b border-border bg-muted/40 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-primary-soft text-primary-soft-foreground">
                  VISTA PREVIA
                </span>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-muted text-foreground border border-border">
                  {folio ? `FOLIO: ${folio}` : 'FOLIO: REQ-NUEVA'}
                </span>
                {ordenCompraFolio && (
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary-soft text-primary-soft-foreground border border-primary/40">
                    OC: {ordenCompraFolio}
                  </span>
                )}
              </div>
              <h2
                id="solicitud-preview-title"
                className="text-base font-bold text-foreground"
              >
                Solicitud para requisición de materiales
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                <p>
                  Proyecto: <strong className="text-foreground font-semibold">{obraNombrePrincipal}</strong>
                </p>
                {solicitanteNombre && (
                  <>
                    <span>·</span>
                    <p>
                      Solicitado por: <strong className="text-foreground font-semibold">{solicitanteNombre}</strong>
                    </p>
                  </>
                )}
                <span>·</span>
                <p>
                  Fecha: <strong className="text-foreground font-medium">{displayFecha}</strong>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
              aria-label="Cerrar vista previa"
            >
              <IconCerrar className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Alerta si hay saldo insuficiente */}
        {tieneAlertas && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-warning-soft border border-warning/30 text-warning-soft-foreground flex items-start gap-2.5 text-xs">
            <IconAlerta className="w-4 h-4 shrink-0 mt-0.5 text-warning" />
            <div>
              <p className="font-bold">Advertencia de saldo insuficiente:</p>
              <p className="mt-0.5">
                {itemsConAlerta.length} partida(s) solicitan más material del disponible asignado. Compras deberá autorizar la excepción o ajustar el presupuesto.
              </p>
            </div>
          </div>
        )}

        {/* Nota general */}
        {Boolean(notaGeneral?.trim()) && (
          <div className="mx-5 mt-3 p-3 bg-muted/40 rounded-xl border border-border text-xs">
            <p className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] mb-0.5">
              Nota general:
            </p>
            <p className="text-foreground">{notaGeneral}</p>
          </div>
        )}

        {/* Lista de partidas */}
        <div className="p-5 overflow-y-auto space-y-2.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground pb-1 border-b border-border/50 font-semibold uppercase tracking-wider">
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
                    ? 'border-danger/30 bg-danger-soft/40'
                    : 'border-border bg-card hover:border-input'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-muted-foreground font-mono">
                        #{idx + 1}
                      </span>
                      <p className="text-sm font-semibold text-foreground">
                        {it.nombre}
                      </p>
                      {it.variante && (
                        <span className="text-xs text-muted-foreground">· {it.variante}</span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                        {labelTipoLinea(it.tipo_linea)}
                      </span>
                    </div>

                    {it.obraNombre && it.obraNombre !== obraNombrePrincipal && (
                      <p className="text-xs font-semibold text-primary mt-1">
                        Proyecto destino: {it.obraNombre}
                      </p>
                    )}

                    {it.nota && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        &quot;{it.nota}&quot;
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    {it.tipo_linea === 'material' ? (
                      <p className="text-sm font-bold text-foreground tabular-nums">
                        {it.cantidad} {it.unidad_medida}
                      </p>
                    ) : (
                      it.monto_mxn != null && (
                        <p className="text-sm font-bold text-primary tabular-nums">
                          {formatMoneyMx(it.monto_mxn)}
                        </p>
                      )
                    )}

                    {it.tipo_linea === 'material' && it.disponible !== null && it.disponible !== undefined && (
                      <p
                        className={`text-[11px] tabular-nums mt-0.5 ${
                          insuficiente
                            ? 'text-danger font-semibold'
                            : 'text-muted-foreground'
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
        <footer className="px-5 py-3.5 border-t border-border bg-muted/40 flex items-center justify-between shrink-0 gap-3">
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
            className="btn-primary btn-sm min-h-[44px]"
          >
            <IconCheck className="w-4 h-4" />
            <span>{isSubmitting ? 'Creando requisición…' : 'Confirmar y levantar'}</span>
          </button>
        </footer>
      </div>
    </div>
  )
}
