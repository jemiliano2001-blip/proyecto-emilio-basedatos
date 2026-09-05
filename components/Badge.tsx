import React from 'react'
import { cn } from '@/lib/utils'

export type BadgeVariant = 'teal' | 'amber' | 'red' | 'navy' | 'gray'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  children: React.ReactNode
}

const variantClasses: Record<BadgeVariant, string> = {
  teal: 'badge-teal',
  amber: 'badge-amber',
  red: 'badge-red',
  navy: 'badge-navy',
  gray: 'badge-gray',
}

export function Badge({
  variant = 'gray',
  children,
  className,
  ...props
}: BadgeProps) {
  return (
    <span className={cn(variantClasses[variant], className)} {...props}>
      {children}
    </span>
  )
}
