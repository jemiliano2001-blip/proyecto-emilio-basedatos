import * as React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface KpiMetricCardProps {
  label: string
  value: string | number
  hint?: string
  delta?: {
    value: string
    isPositive: boolean
    label?: string
  }
  sparklineData?: number[]
  sparklineColor?: string
  href?: string
  icon?: React.ReactNode
  variant?: 'default' | 'caregiver' | 'warning' | 'success'
  className?: string
}

export function KpiMetricCard({
  label,
  value,
  hint,
  delta,
  sparklineData = [20, 28, 25, 35, 30, 45, 40, 55, 60],
  sparklineColor,
  href,
  icon,
  variant = 'default',
  className,
}: KpiMetricCardProps) {
  // Generar path para sparkline SVG
  const points = React.useMemo(() => {
    if (!sparklineData || sparklineData.length < 2) return ''
    const min = Math.min(...sparklineData)
    const max = Math.max(...sparklineData)
    const range = max - min || 1
    const width = 100
    const height = 32

    return sparklineData
      .map((val, idx) => {
        const x = (idx / (sparklineData.length - 1)) * width
        const y = height - ((val - min) / range) * (height - 6) - 3
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join(' ')
  }, [sparklineData])

  const defaultColor = delta
    ? delta.isPositive
      ? '#10B981'
      : '#EF4444'
    : '#0369A1'

  const strokeColor = sparklineColor || defaultColor

  const variantStyles = {
    default: 'bg-card border-border/80 shadow-card hover:shadow-elevated',
    caregiver: 'bg-amber-50/40 border-amber-200/70 shadow-sm hover:shadow-elevated',
    warning: 'bg-warning-soft/40 border-warning/30 shadow-sm hover:shadow-elevated',
    success: 'bg-success-soft/40 border-success/30 shadow-sm hover:shadow-elevated',
  }

  const content = (
    <div
      className={cn(
        'group relative flex flex-col justify-between rounded-2xl border p-5 transition-all duration-200',
        variantStyles[variant],
        href && 'cursor-pointer hover:border-input active:scale-[0.99]',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground line-clamp-1">
          {label}
        </span>
        {icon && (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground group-hover:text-primary transition-colors">
            {icon}
          </span>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-3 mt-1">
        <div className="flex flex-col">
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-heading tabular-nums">
            {value}
          </span>

          {hint && (
            <span className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {hint}
            </span>
          )}
        </div>

        {/* Sparkline SVG */}
        {points && (
          <div className="w-24 shrink-0 overflow-hidden self-end mb-1">
            <svg viewBox="0 0 100 32" className="w-full h-8 overflow-visible">
              <path
                d={points}
                fill="none"
                stroke={strokeColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
      </div>

      {delta && (
        <div className="mt-3.5 flex items-center gap-2 border-t border-border/60 pt-2.5 text-xs">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold text-[11px]',
              delta.isPositive
                ? 'bg-success-soft text-success-soft-foreground'
                : 'bg-danger-soft text-danger-soft-foreground'
            )}
          >
            {delta.isPositive ? '↑' : '↓'} {delta.value}
          </span>
          {delta.label && (
            <span className="text-muted-foreground truncate">{delta.label}</span>
          )}
        </div>
      )}
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl">
        {content}
      </Link>
    )
  }

  return content
}
