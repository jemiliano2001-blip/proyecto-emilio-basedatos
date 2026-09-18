import React from 'react'
import { PageHeader } from '@/components/PageHeader'
import { SolicitudesListSkeleton } from '@/components/skeletons/SolicitudesListSkeleton'

export default function SolicitudesLoading() {
  return (
    <main className="page-shell">
      <PageHeader
        title="Control de solicitudes"
        subtitle="Cargando requisiciones…"
      />
      <div className="h-10 w-full rounded-xl bg-muted animate-pulse mb-4" />
      <SolicitudesListSkeleton rows={6} />
    </main>
  )
}
