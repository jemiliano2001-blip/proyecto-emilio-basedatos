import React from 'react'

export function ObrasListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando proyectos"
      className="space-y-2.5 animate-pulse"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="card flex items-center gap-3.5 p-3 sm:p-4"
        >
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-muted shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-5 w-44 rounded bg-muted" />
              <div className="h-5 w-16 rounded-full bg-muted/60" />
            </div>
            <div className="h-4 w-60 rounded bg-muted/50" />
          </div>
          <div className="h-4 w-16 rounded bg-muted/40 shrink-0 hidden sm:block" />
        </div>
      ))}
    </div>
  )
}
