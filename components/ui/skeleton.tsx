import * as React from 'react'
import { cn } from '@/lib/utils'

/** Placeholder de carga con shimmer (clase `.skeleton` en globals.css). */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('skeleton', className)} {...props} />
}

export { Skeleton }
