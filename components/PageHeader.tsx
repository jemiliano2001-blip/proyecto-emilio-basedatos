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
  /** Texto pequeño arriba del título (contexto: "Proyecto · Fraccionamiento X"). */
  eyebrow?: React.ReactNode
  backHref?: string
  backLabel?: string
  action?: PageHeaderAction
  actions?: React.ReactNode
  badge?: React.ReactNode
  /** Contenido debajo del header (tabs, KPIs, meta) sin romper el layout. */
  children?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  subtitle,
  eyebrow,
  backHref,
  backLabel = 'Volver',
  action,
  actions,
  badge,
  children,
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
    <header className={cn('mb-5 sm:mb-6', className)}>
      {backHref && (
        <div className="mb-2.5">
          <Link
            href={backHref}
            className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-all hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <IconFlechaAtras className="size-3.5" />
            <span>{backLabel}</span>
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          {eyebrow && <div className="t-eyebrow mb-2 select-none">{eyebrow}</div>}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="t-h1">{title}</h1>
            {badge && <div className="shrink-0">{badge}</div>}
          </div>
          {desc &&
            (typeof desc === 'string' ? (
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground leading-relaxed">{desc}</p>
            ) : (
              <div className="mt-2 max-w-2xl text-sm text-muted-foreground leading-relaxed">{desc}</div>
            ))}
        </div>

        {(actions || action) && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            {actions}
            {action &&
              (action.href ? (
                <Link href={action.href} className="btn-primary btn-sm">
                  {renderActionIcon(action.icon)}
                  <span>{action.label}</span>
                </Link>
              ) : (
                <button type="button" onClick={action.onClick} className="btn-primary btn-sm">
                  {renderActionIcon(action.icon)}
                  <span>{action.label}</span>
                </button>
              ))}
          </div>
        )}
      </div>

      {children && <div className="mt-4">{children}</div>}
    </header>
  )
}
