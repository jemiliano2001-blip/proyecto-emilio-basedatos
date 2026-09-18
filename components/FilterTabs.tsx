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
      className={cn('flex gap-0.5 rounded-lg bg-muted p-0.5', className)}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => {
        const itemClasses = cn(
          'min-h-[40px] flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-center text-sm font-medium transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-[36px]',
          tab.active
            ? 'bg-card text-foreground shadow-xs'
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
                    'rounded-full px-1.5 text-[11px] font-medium tabular-nums',
                    tab.active ? 'bg-primary-soft text-primary-soft-foreground' : 'bg-border/70 text-muted-foreground'
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
                  'rounded-full px-1.5 text-[11px] font-medium tabular-nums',
                  tab.active ? 'bg-primary-soft text-primary-soft-foreground' : 'bg-border/70 text-muted-foreground'
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
