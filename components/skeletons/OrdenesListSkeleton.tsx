import React from 'react'

export function OrdenesListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando órdenes de compra"
      className="list-stack animate-pulse"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex min-h-[64px] items-start justify-between gap-3 px-3.5 py-3"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-5 w-24 rounded bg-muted" />
              <div className="h-5 w-16 rounded-full bg-muted/60" />
              <div className="h-5 w-20 rounded-full bg-muted/40" />
            </div>
            <div className="h-4 w-40 rounded bg-muted" />
            <div className="h-3.5 w-28 rounded bg-muted/50" />
          </div>
          <div className="text-right shrink-0 space-y-1.5">
            <div className="h-5 w-24 rounded bg-muted ml-auto" />
            <div className="h-3.5 w-16 rounded bg-muted/40 ml-auto" />
          </div>
        </div>
      ))}
    </div>
  )
}
