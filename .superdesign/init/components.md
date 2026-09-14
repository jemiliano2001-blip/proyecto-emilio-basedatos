# Shared UI primitives — ObraTrack

Custom primitives (not shadcn-heavy). Utility classes in `globals.css`: `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.card`, `.card-interactive`, `.input-base`.

## Badge (`components/Badge.tsx` → `components/ui/badge.tsx`)

Wrapper with business variants: `teal` | `amber` | `red` | `navy` | `gray`.

```tsx
// components/Badge.tsx
import React from 'react'
import { Badge as UiBadge, type BadgeProps as UiBadgeProps } from '@/components/ui/badge'

export type BadgeVariant = 'teal' | 'amber' | 'red' | 'navy' | 'gray'

export interface BadgeProps extends Omit<UiBadgeProps, 'variant'> {
  variant?: BadgeVariant
  children: React.ReactNode
}

export function Badge({ variant = 'gray', children, className, ...props }: BadgeProps) {
  return (
    <UiBadge variant={variant} className={className} {...props}>
      {children}
    </UiBadge>
  )
}
```

```tsx
// components/ui/badge.tsx (cva)
const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ...',
  {
    variants: {
      variant: {
        teal: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
        amber: 'bg-amber-50 text-amber-800 border border-amber-200',
        red: 'bg-red-50 text-red-800 border border-red-200',
        navy: 'bg-slate-900 text-teal-300 border border-slate-700',
        gray: 'bg-gray-100 text-gray-700 border border-gray-200',
        // ...
      },
    },
  }
)
```

## PageHeader (`components/PageHeader.tsx`)

Title + optional subtitle, back link, primary action (`btn-primary`).

```tsx
export function PageHeader({ title, description, subtitle, backHref, backLabel = 'Volver', action, actions, badge, className }: PageHeaderProps) {
  const desc = description ?? subtitle
  return (
    <header className={cn('mb-6 pt-2', className)}>
      {backHref && (
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
          <IconFlechaAtras className="h-4 w-4" />
          <span>{backLabel}</span>
        </Link>
      )}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-ink tracking-tight">{title}</h1>
            {badge}
          </div>
          {desc && <p className="mt-1 text-sm text-gray-500">{desc}</p>}
        </div>
        {(actions || action) && (
          <div className="flex shrink-0 items-center gap-2">
            {action?.href ? (
              <Link href={action.href} className="btn-primary text-sm px-4 py-2 inline-flex items-center gap-1.5">
                {action.label}
              </Link>
            ) : null}
            {actions}
          </div>
        )}
      </div>
    </header>
  )
}
```

## EmptyState (`components/EmptyState.tsx`)

Dashed card with icon circle, title, description, optional CTA.

## ListFilters (`components/ListFilters.tsx`)

Card form: search input, estatus select, optional obra select, GET to path. Target redesign: replace with chips + sticky search toolbar.

## Icons (`components/icons.tsx`)

Inline SVG stroke icons (no Lucide): IconProyectos, IconSolicitudes, IconRecepcion, IconOrdenes, IconPaquete, IconMas, IconSearch, IconPlus, IconChevron, etc.
