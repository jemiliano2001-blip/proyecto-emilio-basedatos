import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { RevisarRecepcionForm } from '@/components/RevisarRecepcionForm'
import { RecepcionEvidenciasViewer } from '@/components/RecepcionEvidenciasViewer'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeRevisarRecepcion } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { EstadoRecepcion, EstadoRecepcionItem, RecepcionFoto } from '@/lib/types'

interface DetalleRecepcion {
  id: string
  estado: EstadoRecepcion
  nota: string | null
  referencia_entrega: string | null
  foto_remision_url?: string | null
  foto_evidencia_url?: string | null
  recibido_en: string
  orden: { id: string; folio: string; estado: string } | null
  receptor: { nombre: string } | null
  fotos?: RecepcionFoto[]
  items: {
    id: string
    cantidad_recibida: number
    cantidad_danada: number
    estado: EstadoRecepcionItem
    observacion: string | null
    foto_url?: string | null
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
    <main className="page-shell-narrow">
      <PageHeader
        title="Revisar recepción"
        backHref={`/recepciones/${detalle.id}`}
        backLabel="Detalle"
        subtitle={detalle.orden?.folio}
        description={`${detalle.receptor?.nombre ?? '—'} · ${new Date(
          detalle.recibido_en
        ).toLocaleString('es-MX')}`}
      />

      {/* Evidencias fotográficas para inspección visual previa a la aprobación */}
      <RecepcionEvidenciasViewer
        fotoRemisionUrl={detalle.foto_remision_url}
        fotoEvidenciaUrl={detalle.foto_evidencia_url}
        fotos={detalle.fotos}
        folioOrden={detalle.orden?.folio ?? ''}
      />

      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        Renglones por validar
      </h2>
      <div className="space-y-2 mb-6">
        {(detalle.items ?? []).map((item) => (
          <div key={item.id} className="card flex items-start gap-3">
            {item.foto_url && (
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted border border-border shrink-0 relative shadow-xs">
                <Image
                  src={item.foto_url}
                  alt="Evidencia física"
                  width={56}
                  height={56}
                  unoptimized
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">
                {item.orden_item?.material?.nombre_base}
                {item.orden_item?.material?.variante
                  ? ` · ${item.orden_item.material.variante}`
                  : ''}
              </p>
              <p className="text-xs text-muted-foreground mt-1 capitalize">
                {item.estado} · Buena {Number(item.cantidad_recibida)} · Dañada{' '}
                {Number(item.cantidad_danada)} / Pedido{' '}
                {Number(item.orden_item?.cantidad ?? 0)}{' '}
                {item.orden_item?.material?.unidad_medida}
              </p>
              {item.observacion && (
                <p className="text-xs text-warning-soft-foreground mt-2 font-medium">{item.observacion}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <RevisarRecepcionForm recepcionId={detalle.id} />
    </main>
  )
}
