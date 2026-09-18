import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 select-none',
  {
    variants: {
      variant: {
        default: 'bg-navy text-white border-transparent',
        secondary: 'bg-muted text-foreground border border-border',
        outline: 'border border-border text-foreground bg-transparent',
        teal: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
        amber: 'bg-amber-50 text-amber-800 border border-amber-200',
        red: 'bg-red-50 text-red-800 border border-red-200',
        navy: 'bg-slate-900 text-teal-300 border border-slate-700',
        gray: 'bg-muted text-muted-foreground border border-border',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
