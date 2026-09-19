import React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface EmptyStateAction {
  label: string
  href?: string
  onClick?: () => void
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>
}

export interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode
  title: string
  description?: string
  action?: EmptyStateAction
  className?: string
  headingLevel?: 'h2' | 'h3' | 'h4' | 'p'
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  headingLevel = 'h2',
}: EmptyStateProps) {
  const HeadingTag = headingLevel
  const renderIcon = (iconInput?: React.ComponentType<{ className?: string }> | React.ReactNode, defaultClass = 'h-6 w-6') => {
    if (!iconInput) return null
    if (typeof iconInput === 'function') {
      const IconComponent = iconInput as React.ComponentType<{ className?: string }>
      return <IconComponent className={defaultClass} />
    }
    return iconInput
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-border/80 bg-card/40 px-4 py-12 text-center animate-enter',
        className
      )}
    >
      {icon && (
        <div className="mb-3.5 flex size-12 items-center justify-center rounded-xl bg-muted/80 text-muted-foreground ring-1 ring-border/80 shadow-xs">
          {renderIcon(icon, 'h-6 w-6')}
        </div>
      )}
      <HeadingTag className="text-sm font-semibold text-foreground tracking-tight">{title}</HeadingTag>
      {description && (
        <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground leading-relaxed">{description}</p>
      )}
      {action && (
        <div className="mt-5">
          {action.href ? (
            <Link href={action.href} className="btn-primary btn-sm">
              {renderIcon(action.icon, 'h-4 w-4')}
              <span>{action.label}</span>
            </Link>
          ) : (
            <button type="button" onClick={action.onClick} className="btn-primary btn-sm">
              {renderIcon(action.icon, 'h-4 w-4')}
              <span>{action.label}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
