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

function badgeVariant(estado: EstadoSolicitud): 'red' | 'teal' | 'navy' | 'amber' {
  switch (estado) {
    case 'cancelada':
    case 'rechazada':
      return 'red'
    case 'finalizada':
    case 'aprobada':
      return 'teal'
    case 'en_proceso':
    case 'en_cotizacion':
      return 'navy'
    case 'recibida':
    case 'pendiente':
    default:
      return 'amber'
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
  return n === 1 ? '1 material' : `${n} materiales`
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

  const handleAprobarLote = () => {
    if (selectedArray.length === 0) return
    const confirmMsg =
      esFinanzas
        ? `¿Aprobar el pago y emitir órdenes de compra para ${selectedCount} requisición(es)?`
        : `¿Aprobar ${selectedCount} requisición(es) de compras usando los precios base de referencia?`

    if (!window.confirm(confirmMsg)) return

    startTransition(async () => {
      setFeedback(null)
      const res = await aprobarMultiplesSolicitudesAction(selectedArray)
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
              className="font-semibold text-accent hover:underline py-1"
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
              ? 'bg-teal-50 border-teal-200 text-teal-900'
              : feedback.exitosas > 0
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-red-50 border-red-200 text-red-900'
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
              className="text-gray-500 hover:text-gray-900 p-1"
              aria-label="Cerrar aviso"
            >
              <IconCerrar className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Lista de solicitudes con soporte para shift-select y densidad adaptable */}
      <div
        className={cn(
          'space-y-2 md:space-y-0 md:rounded-xl md:border md:border-border md:bg-card md:divide-y md:divide-border/50 md:overflow-hidden',
          density === 'compact' && 'space-y-1.5 md:space-y-0'
        )}
      >
        {solicitudes.map((s, index) => {
          const selected = isSelected(s.id)
          const reqCode = `REQ-${s.id.slice(0, 8).toUpperCase()}`
          const ordenes = (s.ordenes ?? []) as { id: string; folio: string }[]
          const esMulti = (s.items ?? []).some((i) => i.obra_id !== null)

          return (
            <div
              key={s.id}
              className={cn(
                'card-interactive relative flex items-center gap-3 transition-colors',
                selected ? 'bg-accent/10 border-accent/40' : 'bg-card',
                density === 'comfortable' ? 'p-3.5 sm:p-4 min-h-[76px]' : 'p-2.5 sm:p-3 min-h-[58px]',
                'md:rounded-none md:border-0 md:shadow-none',
                selected ? 'md:bg-accent/10' : 'md:hover:bg-muted/50'
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
                      'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg transition-colors cursor-pointer',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded border transition-colors',
                        selected
                          ? 'bg-accent border-accent text-white font-bold'
                          : 'border-border bg-card hover:border-input'
                      )}
                    >
                      {selected && <IconCheck className="w-3.5 h-3.5" />}
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
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-muted text-foreground border border-border">
                      {reqCode}
                    </span>
                    {ordenes.map((oc) => (
                      <span
                        key={oc.id}
                        className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200"
                      >
                        {oc.folio}
                      </span>
                    ))}
                  </div>
                  <p className="font-semibold text-foreground truncate">
                    {s.obra?.nombre ?? 'Proyecto'}
                  </p>
                  <p
                    className={cn(
                      'text-muted-foreground truncate',
                      density === 'comfortable' ? 'mt-1 text-xs sm:text-sm' : 'mt-0.5 text-xs'
                    )}
                  >
                    {labelMateriales(s.items.length)}
                    {esMulti ? ' · varios proyectos' : ''}
                    {verTodas && s.solicitante?.nombre ? ` · ${s.solicitante.nombre}` : ''}
                    {' · '}
                    {new Date(s.creado_en).toLocaleString('es-MX', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>

                <div className="shrink-0">
                  <Badge variant={badgeVariant(s.estado)}>
                    {labelEstado(s.estado)}
                  </Badge>
                </div>
              </Link>
            </div>
          )
        })}

        {solicitudes.length === 0 && (
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
      </div>

      {/* Floating BulkBar para acciones en lote */}
      {puedeAccionesEnLote && (
        <BulkBar
          selectedCount={selectedCount}
          totalCount={solicitudes.length}
          onClear={clearSelection}
          onSelectAll={selectAll}
          entityName="requisiciones"
          actions={[
            {
              label: esFinanzas ? 'Pagar en lote' : 'Aprobar en lote',
              onClick: handleAprobarLote,
              variant: 'primary',
              disabled: isPending,
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-fade-in"
        >
          <div className="w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border p-5 space-y-4 animate-scale-in">
            <h3 id="rechazo-lote-title" className="text-base font-bold text-foreground">
              Rechazar {selectedCount} requisición(es)
            </h3>
            <p className="text-xs text-muted-foreground">
              Indica opcionalmente el motivo para informar a los solicitantes.
            </p>
            <textarea
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              placeholder="Motivo del rechazo (opcional)…"
              rows={3}
              className="w-full rounded-xl border border-border bg-card p-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRechazoModal(false)}
                className="btn-secondary text-sm px-3 py-2"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarRechazo}
                className="btn-danger text-sm px-4 py-2"
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
