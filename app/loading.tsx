import React from 'react'
import { ObrasListSkeleton } from '@/components/skeletons/ObrasListSkeleton'

export default function HomeLoading() {
  return (
    <main className="page-shell-wide space-y-6" aria-busy="true">
      <div className="mb-5 animate-pulse space-y-2 sm:mb-6">
        <div className="h-3 w-32 rounded bg-muted" />
        <div className="h-7 w-56 rounded bg-muted" />
        <div className="h-4 w-80 max-w-full rounded bg-muted/70" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="stat-tile animate-pulse">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="mt-2 h-7 w-16 rounded bg-muted" />
            <div className="h-3 w-28 rounded bg-muted/70" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <div className="h-5 w-24 animate-pulse rounded bg-muted" />
        <div className="h-10 w-full animate-pulse rounded-lg bg-muted sm:max-w-md" />
        <ObrasListSkeleton rows={5} />
      </div>
    </main>
  )
}
