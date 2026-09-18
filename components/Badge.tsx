import React from 'react'
import { Badge as UiBadge, type BadgeProps as UiBadgeProps } from '@/components/ui/badge'

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  // legacy
  | 'teal'
  | 'amber'
  | 'red'
  | 'navy'
  | 'gray'

export interface BadgeProps extends Omit<UiBadgeProps, 'variant'> {
  variant?: BadgeVariant
  children: React.ReactNode
}

/**
 * Badge de negocio sobre la primitiva components/ui/badge.tsx.
 * Las variantes legacy (teal/amber/red/navy/gray) siguen aceptándose y mapean
 * a success/warning/danger/info/neutral.
 */
export function Badge({ variant = 'neutral', children, className, ...props }: BadgeProps) {
  return (
    <UiBadge variant={variant} className={className} {...props}>
      {children}
    </UiBadge>
  )
}
