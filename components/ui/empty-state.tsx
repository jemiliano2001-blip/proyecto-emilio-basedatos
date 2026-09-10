import * as React from 'react'
import { cn } from '@/lib/utils'

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center sm:p-12 animate-fade-in',
        className
      )}
      {...props}
    >
      {icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-gray-100 text-gray-500">
          {icon}
        </div>
      )}
      <h3 className="text-base sm:text-lg font-bold text-navy">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-gray-500 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
