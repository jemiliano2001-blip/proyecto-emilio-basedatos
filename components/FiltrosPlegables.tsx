'use client'

import { useId, useState, type ReactNode } from 'react'
import { IconChevronDown } from '@/components/icons'
import { cn } from '@/lib/utils'

/** En celular los filtros van plegados para que la lista quede a la vista; desde `sm` siempre se muestran. */
export function FiltrosPlegables({
  activos,
  children,
}: {
  activos: number
  children: ReactNode
}) {
  const [abierto, setAbierto] = useState(false)
  const panelId = useId()

  return (
    <div>
      <button
        type="button"
        className="btn-secondary w-full justify-between sm:hidden"
        aria-expanded={abierto}
        aria-controls={panelId}
        onClick={() => setAbierto((v) => !v)}
      >
        <span className="inline-flex items-center gap-2">
          Filtros
          {activos > 0 && (
            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold tabular-nums text-primary-soft-foreground">
              {activos} {activos === 1 ? 'activo' : 'activos'}
            </span>
          )}
        </span>
        <IconChevronDown className={cn('size-4 transition-transform', abierto && 'rotate-180')} />
      </button>
      <div id={panelId} className={cn(abierto ? 'mt-3 block' : 'hidden', 'sm:mt-0 sm:block')}>
        {children}
      </div>
    </div>
  )
}
