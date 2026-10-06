'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { IconCheck, IconCerrar, IconDocumento } from '@/components/icons'
import { BulkBar } from '@/components/BulkBar'
import { DensityToggle } from '@/components/DensityToggle'
import { useShiftSelect } from '@/lib/hooks/useShiftSelect'
import { useDensity } from '@/lib/hooks/useDensity'
import {
  aprobarMultiplesSolicitudesAction,
  rechazarMultiplesSolicitudesAction,
  type BatchActionResult,
} from '@/lib/actions/solicitudes'
import type { EstadoSolicitud } from '@/lib/types'
import { cn } from '@/lib/utils'
import { etapaAprobacionLote } from '@/lib/solicitudes-workflow'

export interface SolicitudListItem {
  id: string
  estado: EstadoSolicitud
  creado_en: string
  obra: { nombre: string; fraccionamiento: string | null } | null
  solicitante: { nombre: string } | null
  items: { id: string; obra_id: string | null }[]
  ordenes: { id: string; folio: string }[] | null
}

interface SolicitudesListClientProps {
  solicitudes: SolicitudListItem[]
  puedeCrear: boolean
  verTodas: boolean
  esCompras: boolean
  esFinanzas: boolean
}

function badgeVariant(estado: EstadoSolicitud): 'danger' | 'success' | 'info' | 'warning' {
  switch (estado) {
    case 'cancelada':
    case 'rechazada':
      return 'danger'
    case 'finalizada':
    case 'aprobada':
      return 'success'
    case 'en_proceso':
    case 'en_cotizacion':
      return 'info'
    case 'recibida':
    case 'pendiente':
    default:
      return 'warning'
  }
}

function labelEstado(estado: EstadoSolicitud) {
  switch (estado) {
    case 'recibida':
      return 'recibida'
    case 'en_proceso':
      return 'en proceso'
    case 'finalizada':
      return 'finalizada'
    case 'en_cotizacion':
      return 'en cotización'
    case 'pendiente':
      return 'recibida'
    case 'aprobada':
      return 'finalizada'
    default:
      return estado
  }
}

function labelMateriales(n: number): string {
  return n === 1 ? '1 partida' : `${n} partidas`
}

export function SolicitudesListClient({
  solicitudes,
  puedeCrear,
  verTodas,
  esCompras,
  esFinanzas,
}: SolicitudesListClientProps) {
  const { density } = useDensity()
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<BatchActionResult | null>(null)
  const [showRechazoModal, setShowRechazoModal] = useState(false)
  const [motivoRechazo, setMotivoRechazo] = useState('')

  const {
    selectedIds,
    selectedCount,
    isSelected,
    toggleSelect,
    selectAll,
    clearSelection,
  } = useShiftSelect({
    items: solicitudes,
    getItemId: (item) => item.id,
  })

  const puedeAccionesEnLote = esCompras || esFinanzas
  const selectedArray = Array.from(selectedIds)
  const etapa = etapaAprobacionLote(solicitudes.filter(s => selectedIds.has(s.id)).map(s => s.estado), esCompras, esFinanzas)

  const handleAprobarLote = () => {
    if (selectedArray.length === 0 || !etapa) return
    const confirmMsg =
      etapa === 'finanzas'
        ? `¿Aprobar el pago y emitir órdenes de compra para ${selectedCount} requisición(es)?`
        : `¿Aprobar ${selectedCount} requisición(es) de compras usando los precios base de referencia?`

    if (!window.confirm(confirmMsg)) return

    startTransition(async () => {
      setFeedback(null)
      const res = await aprobarMultiplesSolicitudesAction(selectedArray, etapa)
      setFeedback(res)
      if (res.exitosas > 0) {
        clearSelection()
      }
    })
  }

  const handleRechazarLote = () => {
    if (selectedArray.length === 0) return
    setShowRechazoModal(true)
  }

  const handleConfirmarRechazo = () => {
    setShowRechazoModal(false)
    startTransition(async () => {
      setFeedback(null)
      const res = await rechazarMultiplesSolicitudesAction(selectedArray, motivoRechazo)
      setFeedback(res)
      setMotivoRechazo('')
      if (res.exitosas > 0) {
        clearSelection()
      }
    })
  }

  return (
    <div className="space-y-3">
      {/* Barra de control de vista: Densidad y selección */}
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          {puedeAccionesEnLote && solicitudes.length > 0 && (
            <button
              type="button"
              onClick={selectedCount === solicitudes.length ? clearSelection : selectAll}
              className="font-semibold text-primary hover:underline py-1"
            >
              {selectedCount === solicitudes.length
                ? 'Deseleccionar todas'
                : `Seleccionar todas (${solicitudes.length})`}
            </button>
          )}
        </div>
        <DensityToggle />
      </div>

      {/* Banner de retroalimentación de acción en lote */}
      {feedback && (
        <div
          role="status"
          className={cn(
            'p-3.5 rounded-xl text-xs sm:text-sm border transition-all animate-enter',
            feedback.fallidas === 0
              ? 'bg-primary-soft border-primary/30 text-primary-soft-foreground'
              : feedback.exitosas > 0
                ? 'bg-warning-soft border-warning/30 text-warning-soft-foreground'
                : 'bg-danger-soft border-danger/30 text-danger-soft-foreground'
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-bold">
                {feedback.fallidas === 0
                  ? `Se procesaron exitosamente ${feedback.exitosas} requisición(es).`
                  : `Procesadas: ${feedback.exitosas} exitosas, ${feedback.fallidas} con observación.`}
              </p>
              {feedback.errores.length > 0 && (
                <ul className="mt-1.5 list-disc list-inside space-y-0.5 text-xs opacity-90">
                  {feedback.errores.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-muted-foreground hover:text-foreground p-1"
              aria-label="Cerrar aviso"
            >
              <IconCerrar className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Lista de solicitudes unificada en list-stack */}
      {solicitudes.length > 0 ? (
        <div className="list-stack">
          {solicitudes.map((s, index) => {
            const selected = isSelected(s.id)
            const reqCode = `REQ-${s.id.slice(0, 8).toUpperCase()}`
            const ordenes = (s.ordenes ?? []) as { id: string; folio: string }[]
            const esMulti = (s.items ?? []).some((i) => i.obra_id !== null)

            return (
              <div
                key={s.id}
                className={cn(
                  'list-row group items-center gap-3 transition-colors',
                  selected ? 'bg-primary-soft/40 border-l-4 border-l-primary' : 'hover:bg-muted/30',
                  density === 'comfortable' ? 'min-h-[72px]' : 'min-h-[58px] py-2.5'
                )}
              >
                {/* Checkbox táctil amigable de selección para Compras/Finanzas */}
                {puedeAccionesEnLote && (
                  <div
                    className="shrink-0 flex items-center justify-center"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleSelect(s.id, index, (e.nativeEvent as MouseEvent).shiftKey)
                    }}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={selected}
                      aria-label={`Seleccionar ${reqCode}`}
                      className={cn(
                        'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl transition-colors cursor-pointer',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-5 items-center justify-center rounded-md border transition-all duration-150 shadow-xs',
                          selected
                            ? 'bg-primary border-primary text-primary-foreground font-bold'
                            : 'border-border/90 bg-card hover:border-input'
                        )}
                      >
                        {selected && <IconCheck className="size-3.5 stroke-[2.5]" />}
                      </span>
                    </button>
                  </div>
                )}

                {/* Contenido principal clicable hacia el detalle */}
                <Link
                  href={`/solicitudes/${s.id}`}
                  className="min-w-0 flex-1 flex items-start justify-between gap-3"
                  onClick={(e) => {
                    if (e.shiftKey && puedeAccionesEnLote) {
                      e.preventDefault()
                      toggleSelect(s.id, index, true)
                    }
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-lg bg-muted/80 text-foreground border border-border/80 shadow-2xs">
                        {reqCode}
                      </span>
                      {ordenes.map((oc) => (
                        <span
                          key={oc.id}
                          className="font-mono text-xs font-semibold px-2 py-0.5 rounded-lg bg-primary-soft text-primary-soft-foreground border border-primary/25 shadow-2xs"
                        >
                          {oc.folio}
                        </span>
                      ))}
                    </div>
                    <p className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors font-sans">
                      {s.obra?.nombre ?? 'Proyecto'}
                    </p>
                    <p
                      className={cn(
                        'text-muted-foreground truncate',
                        density === 'comfortable' ? 'mt-1 text-xs' : 'mt-0.5 text-xs'
                      )}
                    >
                      {labelMateriales(s.items.length)}
                      {esMulti ? ' · varios proyectos' : ''}
                      {s.solicitante?.nombre ? ` · Solicitó: ${s.solicitante.nombre}` : ''}
                      {' · '}
                      {new Date(s.creado_en).toLocaleString('es-MX', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>

                  <div className="shrink-0 pt-0.5">
                    <Badge variant={badgeVariant(s.estado)} dot>
                      {labelEstado(s.estado)}
                    </Badge>
                  </div>
                </Link>
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={IconDocumento}
          title="Sin resultados"
          description={
            verTodas
              ? 'Todavía no hay requisiciones registradas en el sistema.'
              : 'Todavía no has levantado ninguna requisición.'
          }
          action={
            puedeCrear
              ? {
                  label: 'Nueva requisición',
                  href: '/solicitudes/nueva',
                }
              : undefined
          }
        />
      )}

      {/* Floating BulkBar para acciones en lote */}
      {selectedCount > 0 && !etapa && (
        <p role="status" className="text-sm text-muted-foreground">Selecciona requisiciones de una sola etapa que puedas aprobar.</p>
      )}
      {puedeAccionesEnLote && (
        <BulkBar
          selectedCount={selectedCount}
          totalCount={solicitudes.length}
          onClear={clearSelection}
          onSelectAll={selectAll}
          entityName="requisiciones"
          actions={[
            {
              label: etapa === 'finanzas' ? 'Pagar en lote' : 'Aprobar en Compras',
              onClick: handleAprobarLote,
              variant: 'primary',
              disabled: isPending || !etapa,
              loading: isPending,
              icon: <IconCheck className="w-4 h-4" />,
            },
            {
              label: 'Rechazar en lote',
              onClick: handleRechazarLote,
              variant: 'danger',
              disabled: isPending,
              loading: isPending,
            },
          ]}
        />
      )}

      {/* Modal para motivo de rechazo en lote */}
      {showRechazoModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rechazo-lote-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/50 backdrop-blur-sm animate-fade-in"
        >
          <div className="w-full max-w-md bg-card rounded-2xl shadow-elevated border border-border p-6 space-y-4 animate-scale-in">
            <h3 id="rechazo-lote-title" className="text-base sm:text-lg font-bold font-heading text-foreground">
              Rechazar {selectedCount} requisición(es)
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Indica opcionalmente el motivo para informar a los solicitantes.
            </p>
            <textarea
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              placeholder="Motivo del rechazo (opcional)…"
              rows={3}
              className="input-base min-h-[80px] py-2.5 text-sm resize-none"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRechazoModal(false)}
                className="btn-secondary btn-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarRechazo}
                className="btn-danger btn-sm"
              >
                Confirmar rechazo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
