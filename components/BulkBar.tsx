'use client'

import React from 'react'
import { IconCerrar } from '@/components/icons'
import { cn } from '@/lib/utils'

export interface BulkBarAction {
  label: string
  onClick: () => void
  variant?: 'primary' | 'danger' | 'secondary'
  icon?: React.ReactNode
  disabled?: boolean
  loading?: boolean
}

export interface BulkBarProps {
  selectedCount: number
  totalCount?: number
  onClear: () => void
  onSelectAll?: () => void
  actions?: BulkBarAction[]
  children?: React.ReactNode
  className?: string
  entityName?: string
}

export function BulkBar({
  selectedCount,
  totalCount,
  onClear,
  onSelectAll,
  actions,
  children,
  className,
  entityName = 'elementos',
}: BulkBarProps) {
  if (selectedCount === 0) return null

  return (
    <div
      role="toolbar"
      aria-label="Acciones en lote"
      className={cn(
        'fixed left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-xl',
        'bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-6',
        'bg-ink text-white rounded-2xl p-3 sm:px-4 sm:py-3 shadow-2xl border border-white/10',
        'flex items-center justify-between gap-3 animate-slide-in-bottom print:hidden',
        className
      )}
    >
      {/* Información de selección */}
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white tabular-nums">
          {selectedCount}
        </span>
        <div className="min-w-0 text-xs sm:text-sm">
          <p className="font-semibold text-white truncate">
            {selectedCount} {entityName} seleccionad{selectedCount === 1 ? 'o' : 'os'}
          </p>
          {onSelectAll && totalCount && selectedCount < totalCount && (
            <button
              type="button"
              onClick={onSelectAll}
              className="text-[11px] text-teal-300 hover:text-teal-200 underline font-medium"
            >
              Seleccionar todos ({totalCount})
            </button>
          )}
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex items-center gap-2 shrink-0">
        {actions &&
          actions.map((act, index) => {
            const variantClass =
              act.variant === 'danger'
                ? 'bg-danger text-white hover:bg-danger/90'
                : act.variant === 'secondary'
                  ? 'bg-white/10 text-white hover:bg-white/20'
                  : 'bg-accent text-white hover:bg-teal-600'

            return (
              <button
                key={index}
                type="button"
                disabled={act.disabled || act.loading}
                onClick={act.onClick}
                className={cn(
                  'inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold transition-all active:scale-[0.98]',
                  variantClass,
                  'disabled:opacity-50 disabled:pointer-events-none'
                )}
              >
                {act.icon}
                <span>{act.loading ? 'Procesando…' : act.label}</span>
              </button>
            )
          })}

        {children}

        {/* Deseleccionar todo */}
        <button
          type="button"
          onClick={onClear}
          className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
          title="Deseleccionar todo (Esc)"
          aria-label="Deseleccionar todo"
        >
          <IconCerrar className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
