import React from 'react'

export function ObrasListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Cargando proyectos" className="list-stack animate-pulse">
      <div className="list-header lg:grid-cols-[2.5rem_minmax(0,2fr)_minmax(0,1.2fr)_6.5rem_1.5rem]">
        <span />
        <span className="h-3 w-16 rounded bg-muted" />
        <span className="h-3 w-12 rounded bg-muted" />
        <span className="h-3 w-12 rounded bg-muted" />
        <span />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-row items-center">
          <div className="size-11 shrink-0 rounded-lg bg-muted lg:size-10" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-48 max-w-full rounded bg-muted" />
            <div className="h-3 w-32 rounded bg-muted/70" />
          </div>
          <div className="hidden h-4 w-28 rounded bg-muted/70 lg:block" />
          <div className="h-5 w-16 rounded-full bg-muted/70" />
          <div className="size-4 shrink-0 rounded bg-muted/50" />
        </div>
      ))}
    </div>
  )
}
