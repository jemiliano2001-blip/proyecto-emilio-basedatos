import Link from 'next/link'
import { IconFlechaAtras } from '@/components/icons'
import { cn } from '@/lib/utils'

export interface PageHeaderAction {
  label: string
  href?: string
  onClick?: () => void
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>
}

export interface PageHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  subtitle?: React.ReactNode
  backHref?: string
  backLabel?: string
  action?: PageHeaderAction
  actions?: React.ReactNode
  badge?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  subtitle,
  backHref,
  backLabel = 'Volver',
  action,
  actions,
  badge,
  className,
}: PageHeaderProps) {
  const desc = description ?? subtitle

  const renderActionIcon = (actionIcon?: React.ReactNode | React.ComponentType<{ className?: string }>) => {
    if (!actionIcon) return null
    if (typeof actionIcon === 'function') {
      const IconComponent = actionIcon as React.ComponentType<{ className?: string }>
      return <IconComponent className="h-4 w-4" />
    }
    return actionIcon
  }

  return (
    <header className={cn('mb-6 pt-2', className)}>
      {backHref && (
        <div className="mb-2">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
          >
            <IconFlechaAtras className="h-4 w-4" />
            <span>{backLabel}</span>
          </Link>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-ink tracking-tight">{title}</h1>
            {badge && <div className="shrink-0">{badge}</div>}
          </div>
          {desc && (
            <p className="mt-1 text-sm text-gray-500">{desc}</p>
          )}
        </div>

        {(actions || action) && (
          <div className="flex shrink-0 items-center gap-2">
            {action && (
              action.href ? (
                <Link
                  href={action.href}
                  className="btn-primary text-sm px-4 py-2 inline-flex items-center gap-1.5"
                >
                  {renderActionIcon(action.icon)}
                  <span>{action.label}</span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={action.onClick}
                  className="btn-primary text-sm px-4 py-2 inline-flex items-center gap-1.5"
                >
                  {renderActionIcon(action.icon)}
                  <span>{action.label}</span>
                </button>
              )
            )}
            {actions}
          </div>
        )}
      </div>
    </header>
  )
}
