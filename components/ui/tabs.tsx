'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export type TabsVariant = 'segmented' | 'pill' | 'underline'

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
  variant: TabsVariant
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function useTabs() {
  const context = React.useContext(TabsContext)
  if (!context) {
    throw new Error('Tabs components must be used within Tabs')
  }
  return context
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string
  defaultValue?: string
  variant?: TabsVariant
  onValueChange?: (value: string) => void
}

export function Tabs({
  value: controlledValue,
  defaultValue = '',
  variant = 'segmented',
  onValueChange,
  className,
  children,
  ...props
}: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue)
  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue : uncontrolledValue

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      if (!isControlled) {
        setUncontrolledValue(newValue)
      }
      onValueChange?.(newValue)
    },
    [isControlled, onValueChange]
  )

  return (
    <TabsContext.Provider value={{ value, onValueChange: handleValueChange, variant }}>
      <div className={cn('w-full', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: TabsVariant
}

export function TabsList({ className, variant: listVariant, ...props }: TabsListProps) {
  const context = useTabs()
  const activeVariant = listVariant || context.variant

  const variantClasses = {
    segmented: 'inline-flex min-h-[44px] items-center gap-1 overflow-x-auto rounded-2xl bg-muted/80 p-1 text-muted-foreground border border-border/80 shadow-xs [scrollbar-width:none]',
    pill: 'inline-flex min-h-[44px] items-center gap-1.5 overflow-x-auto rounded-full bg-muted/60 p-1.5 text-muted-foreground border border-border/60 [scrollbar-width:none]',
    underline: 'flex min-h-[44px] items-center gap-6 overflow-x-auto border-b border-border bg-transparent p-0 [scrollbar-width:none]',
  }

  return (
    <div
      role="tablist"
      className={cn(variantClasses[activeVariant], className)}
      {...props}
    />
  )
}

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
  variant?: TabsVariant
}

export function TabsTrigger({ value, variant: triggerVariant, className, children, ...props }: TabsTriggerProps) {
  const { value: activeValue, onValueChange, variant: contextVariant } = useTabs()
  const activeVariant = triggerVariant || contextVariant
  const isActive = activeValue === value

  const triggerStyles: Record<TabsVariant, string> = {
    segmented: cn(
      'inline-flex min-h-[38px] cursor-pointer select-none items-center justify-center whitespace-nowrap rounded-xl px-4 py-1.5 text-sm font-medium transition-all duration-180 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]',
      isActive
        ? 'bg-card text-foreground font-semibold shadow-xs'
        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
    ),
    pill: cn(
      'inline-flex min-h-[36px] cursor-pointer select-none items-center justify-center whitespace-nowrap rounded-full px-4 py-1 text-sm font-medium transition-all duration-180 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]',
      isActive
        ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
        : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
    ),
    underline: cn(
      'inline-flex min-h-[44px] cursor-pointer select-none items-center justify-center whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-all duration-180 -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]',
      isActive
        ? 'border-primary text-primary font-bold'
        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
    ),
  }

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      data-state={isActive ? 'active' : 'inactive'}
      onClick={() => onValueChange(value)}
      className={cn(triggerStyles[activeVariant], className)}
      {...props}
    >
      {children}
    </button>
  )
}

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

export function TabsContent({ value, className, children, ...props }: TabsContentProps) {
  const { value: activeValue } = useTabs()
  const isSelected = activeValue === value

  if (!isSelected) return null

  return (
    <div
      role="tabpanel"
      data-state={isSelected ? 'active' : 'inactive'}
      tabIndex={0}
      className={cn(
        'mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 animate-fade-in',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
