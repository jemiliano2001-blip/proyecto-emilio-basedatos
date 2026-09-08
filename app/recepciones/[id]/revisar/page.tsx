import { notFound, redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { RevisarRecepcionForm } from '@/components/RevisarRecepcionForm'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeRevisarRecepcion } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { EstadoRecepcion, EstadoRecepcionItem } from '@/lib/types'

interface DetalleRecepcion {
  id: string
  estado: EstadoRecepcion
  nota: string | null
  referencia_entrega: string | null
  recibido_en: string
  orden: { id: string; folio: string; estado: string } | null
  receptor: { nombre: string } | null
  items: {
    id: string
    cantidad_recibida: number
    cantidad_danada: number
    estado: EstadoRecepcionItem
    observacion: string | null
    orden_item: {
      cantidad: number
      material: {
        nombre_base: string
        variante: string | null
        unidad_medida: string
      } | null
    } | null
  }[]
}

export default async function RevisarRecepcionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedparams = await params
  const session = await getSessionUsuario()
  if (!session || !puedeRevisarRecepcion(session.rol)) {
    redirect('/recepciones')
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('detalle_recepcion', {
    p_recepcion_id: resolvedparams.id,
  })

  if (error || !data) notFound()

  const detalle = data as DetalleRecepcion

  if (detalle.estado !== 'pendiente_revision') {
    redirect(`/recepciones/${detalle.id}`)
  }

  return (
    <main className="page-shell">
      <PageHeader
        title="Revisar recepción"
        backHref={`/recepciones/${detalle.id}`}
        backLabel="Detalle"
        subtitle={detalle.orden?.folio}
        description={`${detalle.receptor?.nombre ?? '—'} · ${new Date(
          detalle.recibido_en
        ).toLocaleString('es-MX')}`}
      />

      <div className="space-y-2 mb-6">
        {(detalle.items ?? []).map((item) => (
          <div key={item.id} className="card">
            <p className="font-medium text-sm">
              {item.orden_item?.material?.nombre_base}
              {item.orden_item?.material?.variante
                ? ` · ${item.orden_item.material.variante}`
                : ''}
            </p>
            <p className="text-xs text-gray-500 mt-1 capitalize">
              {item.estado} · Buena {Number(item.cantidad_recibida)} · Dañada{' '}
              {Number(item.cantidad_danada)} / Pedido{' '}
              {Number(item.orden_item?.cantidad ?? 0)}
            </p>
            {item.observacion && (
              <p className="text-xs text-amber-800 mt-2">{item.observacion}</p>
            )}
          </div>
        ))}
      </div>

      <RevisarRecepcionForm recepcionId={detalle.id} />
    </main>
  )
}
