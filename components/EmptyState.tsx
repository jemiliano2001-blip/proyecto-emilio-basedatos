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
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
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
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-input bg-card/60 px-4 py-12 text-center animate-fade-in',
        className
      )}
    >
      {icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          {renderIcon(icon, 'h-6 w-6')}
        </div>
      )}
      <p className="text-base font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      )}
      {action && (
        <div className="mt-6">
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
