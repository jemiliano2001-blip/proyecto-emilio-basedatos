'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface DateRange {
  from: string
  to: string
}

export interface DateRangePickerProps {
  value?: DateRange
  defaultValue?: DateRange
  onChange?: (range: DateRange) => void
  label?: string
  className?: string
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

export function DateRangePicker({
  value: controlledValue,
  defaultValue,
  onChange,
  label = 'Rango de fechas',
  className,
}: DateRangePickerProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState<DateRange>(
    defaultValue || { from: formatDate(new Date()), to: formatDate(new Date()) }
  )
  const [activePreset, setActivePreset] = React.useState<string | null>(null)

  const isControlled = controlledValue !== undefined
  const range = isControlled ? controlledValue : uncontrolledValue

  const handleUpdate = (newRange: DateRange, presetName?: string) => {
    if (!isControlled) {
      setUncontrolledValue(newRange)
    }
    setActivePreset(presetName || null)
    onChange?.(newRange)
  }

  const applyPreset = (preset: 'hoy' | 'semana' | 'mes' | '30dias') => {
    const today = new Date()
    const to = formatDate(today)
    let from = to

    if (preset === 'hoy') {
      from = to
    } else if (preset === 'semana') {
      const d = new Date()
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Lunes
      d.setDate(diff)
      from = formatDate(d)
    } else if (preset === 'mes') {
      const d = new Date(today.getFullYear(), today.getMonth(), 1)
      from = formatDate(d)
    } else if (preset === '30dias') {
      const d = new Date()
      d.setDate(today.getDate() - 30)
      from = formatDate(d)
    }

    handleUpdate({ from, to }, preset)
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && <label className="field-label">{label}</label>}

      <div className="flex flex-wrap items-center gap-2">
        {/* Presets rápidos */}
        <div className="inline-flex rounded-xl bg-muted/70 p-1 border border-border/80">
          <button
            type="button"
            onClick={() => applyPreset('hoy')}
            className={cn(
              'px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer',
              activePreset === 'hoy'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => applyPreset('semana')}
            className={cn(
              'px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer',
              activePreset === 'semana'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Esta semana
          </button>
          <button
            type="button"
            onClick={() => applyPreset('mes')}
            className={cn(
              'px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer',
              activePreset === 'mes'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Este mes
          </button>
        </div>

        {/* Inputs De / Hasta */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <input
              type="date"
              value={range.from}
              onChange={(e) => handleUpdate({ ...range, from: e.target.value })}
              className="input-base min-h-[38px] px-3 py-1 text-xs sm:text-sm rounded-xl"
              aria-label="Fecha inicial"
            />
          </div>
          <span className="text-muted-foreground text-xs font-semibold">a</span>
          <div className="relative flex items-center">
            <input
              type="date"
              value={range.to}
              onChange={(e) => handleUpdate({ ...range, to: e.target.value })}
              className="input-base min-h-[38px] px-3 py-1 text-xs sm:text-sm rounded-xl"
              aria-label="Fecha final"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
