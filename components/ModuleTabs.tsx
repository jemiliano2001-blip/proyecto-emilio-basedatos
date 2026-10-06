'use client'

import React, { useCallback, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

export interface ModuleTabItem {
  id: string
  label: string
  count?: number
  icon?: React.ReactNode
}

export interface ModuleTabsProps {
  tabs: ModuleTabItem[]
  paramName?: string
  defaultTab?: string
  activeTab?: string
  onChange?: (tabId: string) => void
  ariaLabel?: string
  className?: string
}

export function ModuleTabs({
  tabs,
  paramName = 'tab',
  defaultTab,
  activeTab: controlledActiveTab,
  onChange,
  ariaLabel = 'Pestañas de módulo',
  className,
}: ModuleTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const currentTabParam = searchParams.get(paramName)
  const currentActive =
    controlledActiveTab ??
    currentTabParam ??
    defaultTab ??
    tabs[0]?.id ??
    ''

  const handleTabClick = useCallback(
    (tabId: string) => {
      if (onChange) {
        onChange(tabId)
      }

      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString())
        if (defaultTab && tabId === defaultTab) {
          params.delete(paramName)
        } else {
          params.set(paramName, tabId)
        }
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
      })
    },
    [defaultTab, onChange, paramName, pathname, router, searchParams]
  )

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'flex items-center gap-1 p-1 bg-muted/60 rounded-xl border border-border/50 overflow-x-auto shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === currentActive

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => handleTabClick(tab.id)}
            className={cn(
              'min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 shrink-0 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[34px]',
              isActive
                ? 'bg-card text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums transition-colors',
                  isActive
                    ? 'bg-primary-soft text-primary'
                    : 'bg-muted text-muted-foreground'
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
