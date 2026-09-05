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
        'card text-center py-12 px-4 border-dashed border-gray-300 flex flex-col items-center justify-center space-y-2',
        className
      )}
    >
      {icon && (
        <div className="mb-1 rounded-full bg-gray-100 p-3 text-gray-400">
          {renderIcon(icon, 'h-6 w-6')}
        </div>
      )}
      <p className="font-semibold text-ink text-base">{title}</p>
      {description && (
        <p className="text-sm text-gray-500 max-w-md mx-auto">{description}</p>
      )}
      {action && (
        <div className="pt-3">
          {action.href ? (
            <Link href={action.href} className="btn-primary text-sm px-4 py-2 inline-flex items-center gap-1.5">
              {renderIcon(action.icon, 'h-4 w-4')}
              <span>{action.label}</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="btn-primary text-sm px-4 py-2 inline-flex items-center gap-1.5"
            >
              {renderIcon(action.icon, 'h-4 w-4')}
              <span>{action.label}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
