'use client'

import React from 'react'

export function SkeletonBox({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gray-200/80 ${className}`}
      aria-hidden="true"
    />
  )
}

export function SkeletonProjectCard() {
  return (
    <div className="card flex items-center justify-between gap-3 min-h-[56px]">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <SkeletonBox className="h-5 w-44" />
          <SkeletonBox className="h-4 w-16 rounded-full" />
        </div>
        <SkeletonBox className="h-3 w-32" />
      </div>
      <SkeletonBox className="h-5 w-5 rounded-full shrink-0" />
    </div>
  )
}

export function SkeletonMaterialCard() {
  return (
    <div className="card p-3 space-y-3">
      <div className="flex items-start gap-3">
        <SkeletonBox className="w-14 h-14 rounded-lg shrink-0" />
        <div className="flex-1 space-y-2">
          <SkeletonBox className="h-4 w-3/4" />
          <SkeletonBox className="h-3 w-1/2" />
        </div>
      </div>
      <div className="grid grid-cols-5 gap-2 pt-2 border-t border-gray-100">
        <SkeletonBox className="h-10 rounded" />
        <SkeletonBox className="h-10 rounded" />
        <SkeletonBox className="h-10 rounded" />
        <SkeletonBox className="h-10 rounded" />
        <SkeletonBox className="h-10 rounded" />
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
