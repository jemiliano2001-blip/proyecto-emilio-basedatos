'use client'

import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export function SkeletonBox({ className = '' }: { className?: string }) {
  return <Skeleton className={className} />
}

export function SkeletonProjectCard() {
  return (
    <div className="card flex items-center justify-between gap-3 min-h-[56px]">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-5 w-5 rounded-full shrink-0" />
    </div>
  )
}

export function SkeletonMaterialCard() {
  return (
    <div className="card p-3 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="w-14 h-14 rounded-lg shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="grid grid-cols-5 gap-2 pt-2 border-t border-gray-100">
        <Skeleton className="h-10 rounded" />
        <Skeleton className="h-10 rounded" />
        <Skeleton className="h-10 rounded" />
        <Skeleton className="h-10 rounded" />
        <Skeleton className="h-10 rounded" />
      </div>
    </div>
  )
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonProjectCard key={i} />
      ))}
    </div>
  )
}
