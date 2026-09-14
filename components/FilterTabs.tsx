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
      className={cn('flex gap-2 p-1 bg-gray-100/80 rounded-xl border border-gray-200/80', className)}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => {
        const itemClasses = cn(
          'min-h-[44px] flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-center text-sm font-semibold transition-colors select-none',
          tab.active
            ? 'bg-ink text-white shadow-xs'
            : 'text-gray-600 hover:text-ink hover:bg-white/60'
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
                    'text-xs px-1.5 py-0.2 rounded-full font-bold',
                    tab.active ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
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
                  'text-xs px-1.5 py-0.2 rounded-full font-bold',
                  tab.active ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
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
