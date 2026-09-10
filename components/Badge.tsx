import React from 'react'
import { Badge as UiBadge, type BadgeProps as UiBadgeProps } from '@/components/ui/badge'

export type BadgeVariant = 'teal' | 'amber' | 'red' | 'navy' | 'gray'

export interface BadgeProps extends Omit<UiBadgeProps, 'variant'> {
  variant?: BadgeVariant
  children: React.ReactNode
}

/**
 * Componente Badge conectado a la primitiva oficial components/ui/badge.tsx
 * Mantiene 100% de retrocompatibilidad con las variantes de negocio del proyecto.
 */
export function Badge({
  variant = 'gray',
  children,
  className,
  ...props
}: BadgeProps) {
  return (
    <UiBadge variant={variant} className={className} {...props}>
      {children}
    </UiBadge>
  )
}
