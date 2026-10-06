import React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface TabItem {
  key: string
  label: string
  active: boolean
  href?: string
  onClick?: () => void
  count?: number
}

export interface FilterTabsProps {
  tabs: TabItem[]
  ariaLabel?: string
  className?: string
}

export function FilterTabs({ tabs, ariaLabel = 'Filtros', className }: FilterTabsProps) {
  return (
    <div
      className={cn('flex gap-1 rounded-xl bg-muted/60 p-1 border border-border/50', className)}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => {
        const itemClasses = cn(
          'min-h-[38px] flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-center text-xs sm:text-sm font-semibold transition-all select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[34px]',
          tab.active
            ? 'bg-card text-foreground shadow-xs font-bold'
            : 'text-muted-foreground hover:text-foreground'
        )

        if (tab.href) {
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={itemClasses}
              role="tab"
              aria-selected={tab.active}
              scroll={false}
            >
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums transition-colors',
                    tab.active ? 'bg-primary-soft text-primary' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </Link>
          )
        }

        return (
          <button
            key={tab.key}
            type="button"
            onClick={tab.onClick}
            className={itemClasses}
            role="tab"
            aria-selected={tab.active}
          >
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums transition-colors',
                  tab.active ? 'bg-primary-soft text-primary' : 'bg-muted text-muted-foreground'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
