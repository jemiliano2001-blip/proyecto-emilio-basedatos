import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-0.5 text-xs font-semibold transition-colors select-none [&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground border-transparent shadow-xs',
        secondary: 'bg-secondary text-secondary-foreground border-transparent shadow-xs',
        support: 'bg-secondary text-secondary-foreground border-transparent shadow-xs',
        outline: 'border-border text-foreground bg-transparent',
        success: 'bg-success-soft text-success-soft-foreground border-success/25',
        warning: 'bg-warning-soft text-warning-soft-foreground border-warning/30',
        danger: 'bg-danger-soft text-danger-soft-foreground border-danger/25',
        info: 'bg-primary-soft text-primary-soft-foreground border-primary/25',
        neutral: 'bg-muted text-muted-foreground border-border',
        // Variantes solid
        'solid-success': 'bg-success text-success-foreground border-transparent shadow-xs',
        'solid-warning': 'bg-warning text-warning-foreground border-transparent shadow-xs',
        'solid-danger': 'bg-danger text-danger-foreground border-transparent shadow-xs',
        'solid-info': 'bg-primary text-primary-foreground border-transparent shadow-xs',
        // Variantes outline semánticas
        'outline-success': 'bg-transparent text-success-soft-foreground border-success/40',
        'outline-warning': 'bg-transparent text-warning-soft-foreground border-warning/40',
        'outline-danger': 'bg-transparent text-danger-soft-foreground border-danger/40',
        'outline-info': 'bg-transparent text-primary border-primary/40',
        // Alias legacy de negocio (teal/amber/red/navy/gray)
        teal: 'bg-success-soft text-success-soft-foreground border-success/25',
        amber: 'bg-warning-soft text-warning-soft-foreground border-warning/30',
        red: 'bg-danger-soft text-danger-soft-foreground border-danger/25',
        navy: 'bg-primary-soft text-primary-soft-foreground border-primary/25',
        gray: 'bg-muted text-muted-foreground border-border',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Punto de color a la izquierda (útil en listas densas). */
  dot?: boolean
}

function Badge({ className, variant, dot = false, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  )
}

export { Badge, badgeVariants }
