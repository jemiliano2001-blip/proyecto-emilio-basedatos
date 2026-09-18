import Link from 'next/link'
import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/Badge'
import { CopyButton } from '@/components/CopyButton'
import { RecepcionEvidenciasViewer } from '@/components/RecepcionEvidenciasViewer'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeRevisarRecepcion, puedeVerRecepciones } from '@/lib/roles'
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
  revisado_en: string | null
  nota_revision: string | null
  orden: { id: string; folio: string; estado: string } | null
  receptor: { nombre: string } | null
  revisor: { nombre: string } | null
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

function etiquetaEstado(estado: EstadoRecepcion): string {
  if (estado === 'pendiente_revision') return 'Pendiente de revisión'
  if (estado === 'aprobada') return 'Aprobada'
  return 'Rechazada'
}

export default async function RecepcionDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedparams = await params
  const session = await getSessionUsuario()
  if (!session || !puedeVerRecepciones(session.rol)) {
    redirect('/')
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('detalle_recepcion', {
    p_recepcion_id: resolvedparams.id,
  })

  if (error || !data) notFound()

  const detalle = data as DetalleRecepcion
  const puedeRevisar =
    puedeRevisarRecepcion(session.rol) && detalle.estado === 'pendiente_revision'

  return (
    <main className="page-shell">
      <PageHeader
        title={detalle.orden?.folio ?? 'Recepción'}
        backHref="/recepciones"
        backLabel="Recepción"
        badge={
          <Badge
            variant={
              detalle.estado === 'aprobada'
                ? 'teal'
                : detalle.estado === 'pendiente_revision'
                ? 'amber'
                : 'red'
            }
          >
            {etiquetaEstado(detalle.estado)}
          </Badge>
        }
        description={`Capturado por ${detalle.receptor?.nombre ?? '—'} · ${new Date(
          detalle.recibido_en
        ).toLocaleString('es-MX')}`}
      />

      {(detalle.referencia_entrega || detalle.nota) && (
        <div className="card mb-4 space-y-1">
          {detalle.referencia_entrega && (
            <div className="flex items-center justify-between gap-2 text-sm">
              <p>
                <span className="text-muted-foreground">Referencia:</span> {detalle.referencia_entrega}
              </p>
              <CopyButton text={detalle.referencia_entrega} label="Copiar ref." className="text-[11px]" />
            </div>
          )}
          {detalle.nota && (
            <p className="text-sm">
              <span className="text-muted-foreground">Nota:</span> {detalle.nota}
            </p>
          )}
        </div>
      )}

      {/* Evidencias fotográficas si existen */}
      <RecepcionEvidenciasViewer
        fotoRemisionUrl={detalle.foto_remision_url}
        fotoEvidenciaUrl={detalle.foto_evidencia_url}
        fotos={detalle.fotos}
        folioOrden={detalle.orden?.folio ?? ''}
      />

      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        Renglones
      </h2>
      <div className="space-y-2 mb-4">
        {(detalle.items ?? []).map((item) => (
          <div key={item.id} className="card flex items-start gap-3">
            {item.foto_url && (
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted border border-border shrink-0 relative shadow-xs">
                <Image
                  src={item.foto_url}
                  alt="Foto del material"
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
                <p className="text-xs text-warning-soft-foreground mt-2">{item.observacion}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {detalle.revisado_en && (
        <div className="card mb-4 text-sm">
          <p>
            Revisado por {detalle.revisor?.nombre ?? '—'} ·{' '}
            {new Date(detalle.revisado_en).toLocaleString('es-MX')}
          </p>
          {detalle.nota_revision && (
            <p className="text-muted-foreground mt-1">{detalle.nota_revision}</p>
          )}
        </div>
      )}

      <div className="space-y-3 pt-2">
        {puedeRevisar && (
          <Link
            href={`/recepciones/${detalle.id}/revisar`}
            className="btn-primary w-full text-center block"
          >
            Revisar checklist
          </Link>
        )}

        {detalle.orden?.id && (
          <Link
            href={`/ordenes/${detalle.orden.id}/recibir`}
            className="btn-secondary w-full text-center block"
          >
            Registrar otra recepción de esta OC
          </Link>
        )}
      </div>
    </main>
  )
}
