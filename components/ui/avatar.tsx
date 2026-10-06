'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export type AvatarStatus = 'online' | 'busy' | 'offline'
export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl'

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null
  alt?: string
  name?: string | null
  status?: AvatarStatus
  size?: AvatarSize
}

function extractInitials(name?: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

const sizeClasses: Record<AvatarSize, { container: string; status: string; text: string }> = {
  sm: { container: 'size-8', status: 'size-2.5 ring-1.5', text: 'text-xs' },
  md: { container: 'size-10', status: 'size-3 ring-2', text: 'text-sm' },
  lg: { container: 'size-12', status: 'size-3.5 ring-2', text: 'text-base font-semibold' },
  xl: { container: 'size-16', status: 'size-4 ring-2.5', text: 'text-lg font-bold' },
}

const statusColors: Record<AvatarStatus, { dot: string; label: string }> = {
  online: { dot: 'bg-success', label: 'En línea' },
  busy: { dot: 'bg-warning', label: 'Ocupado' },
  offline: { dot: 'bg-muted-foreground', label: 'Desconectado' },
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, name, status, size = 'md', ...props }, ref) => {
    const [imageError, setImageError] = React.useState(false)
    const config = sizeClasses[size]
    const initials = extractInitials(name || alt)

    return (
      <div
        ref={ref}
        className={cn(
          'relative inline-flex shrink-0 items-center justify-center rounded-2xl select-none',
          config.container,
          className
        )}
        {...props}
      >
        <div className="relative size-full overflow-hidden rounded-2xl bg-primary-soft text-primary font-semibold border border-primary/20 shadow-xs flex items-center justify-center">
          {src && !imageError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={alt || name || 'Avatar'}
              onError={() => setImageError(true)}
              className="size-full object-cover"
            />
          ) : (
            <span className={cn('select-none tracking-tight font-sans', config.text)}>
              {initials}
            </span>
          )}
        </div>

        {status && (
          <span
            className={cn(
              'absolute bottom-0 right-0 rounded-full ring-2 ring-card',
              config.status,
              statusColors[status].dot
            )}
            title={statusColors[status].label}
            aria-label={statusColors[status].label}
          >
            {status === 'online' && (
              <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-75" />
            )}
          </span>
        )}
      </div>
    )
  }
)
Avatar.displayName = 'Avatar'

export { Avatar }
