'use client'

import React from 'react'
import { useDensity } from '@/lib/hooks/useDensity'
import { cn } from '@/lib/utils'
import { IconMenu, IconSolicitudes } from '@/components/icons'

export function DensityToggle({ className }: { className?: string }) {
  const { density, setDensity, isReady } = useDensity()

  if (!isReady) return null

  return (
    <div
      role="group"
      aria-label="Densidad de visualización"
      className={cn(
        'inline-flex items-center rounded-lg bg-muted p-0.5 text-xs',
        className
      )}
    >
      <button
        type="button"
        onClick={() => setDensity('comfortable')}
        aria-pressed={density === 'comfortable'}
        title="Modo cómodo (espacio táctil amplio)"
        className={cn(
          'flex min-h-[36px] items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors',
          density === 'comfortable'
            ? 'bg-card text-foreground shadow-xs'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <IconMenu className="size-3.5" />
        <span className="hidden sm:inline">Cómodo</span>
      </button>

      <button
        type="button"
        onClick={() => setDensity('compact')}
        aria-pressed={density === 'compact'}
        title="Modo compacto (mayor densidad de información)"
        className={cn(
          'flex min-h-[36px] items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors',
          density === 'compact'
            ? 'bg-card text-foreground shadow-xs'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <IconSolicitudes className="size-3.5" />
        <span className="hidden sm:inline">Compacto</span>
      </button>
    </div>
  )
}
