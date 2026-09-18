import React from 'react'
import { PageHeader } from '@/components/PageHeader'
import { OrdenesListSkeleton } from '@/components/skeletons/OrdenesListSkeleton'

export default function OrdenesLoading() {
  return (
    <main className="page-shell">
      <PageHeader
        title="Órdenes de compra"
        subtitle="Cargando órdenes…"
      />
      <div className="h-10 w-full rounded-xl bg-muted animate-pulse mb-4" />
      <OrdenesListSkeleton rows={6} />
    </main>
  )
}
