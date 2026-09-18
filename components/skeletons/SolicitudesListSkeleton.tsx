import React from 'react'

export function SolicitudesListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando solicitudes"
      className="space-y-2 md:space-y-0 md:rounded-xl md:border md:border-border md:bg-card md:divide-y md:divide-border/50 md:overflow-hidden animate-pulse"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="card md:rounded-none md:border-0 md:shadow-none p-3.5 sm:p-4 min-h-[76px] flex items-center justify-between gap-3"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-5 w-24 rounded bg-muted" />
              <div className="h-5 w-16 rounded bg-muted/60" />
            </div>
            <div className="h-5 w-48 rounded bg-muted" />
            <div className="h-4 w-32 rounded bg-muted/50" />
          </div>
          <div className="h-6 w-20 rounded-full bg-muted shrink-0" />
        </div>
      ))}
    </div>
  )
}
