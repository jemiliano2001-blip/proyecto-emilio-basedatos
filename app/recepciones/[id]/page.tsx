import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeRevisarRecepcion, puedeVerRecepciones } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { EstadoRecepcion, EstadoRecepcionItem } from '@/lib/types'

interface DetalleRecepcion {
  id: string
  estado: EstadoRecepcion
  nota: string | null
  referencia_entrega: string | null
  recibido_en: string
  revisado_en: string | null
  nota_revision: string | null
  orden: { id: string; folio: string; estado: string } | null
  receptor: { nombre: string } | null
  revisor: { nombre: string } | null
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

function etiquetaEstado(estado: EstadoRecepcion): string {
  if (estado === 'pendiente_revision') return 'Pendiente de revisión'
  if (estado === 'aprobada') return 'Aprobada'
  return 'Rechazada'
}

export default async function RecepcionDetallePage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getSessionUsuario()
  if (!session || !puedeVerRecepciones(session.rol)) {
    redirect('/')
  }

  const supabase = createClient()
  const { data, error } = await supabase.rpc('detalle_recepcion', {
    p_recepcion_id: params.id,
  })

  if (error || !data) notFound()

  const detalle = data as DetalleRecepcion
  const puedeRevisar =
    puedeRevisarRecepcion(session.rol) && detalle.estado === 'pendiente_revision'

  return (
    <main className="page-shell">
      <header className="mb-6 pt-4">
        <Link href="/recepciones" className="text-sm text-[#1E7F7A] font-medium">
          ← Recepción
        </Link>
        <h1 className="text-2xl font-bold text-[#132A45] mt-2">
          {detalle.orden?.folio ?? 'Recepción'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{etiquetaEstado(detalle.estado)}</p>
        <p className="text-xs text-gray-400">
          Capturado por {detalle.receptor?.nombre ?? '—'} ·{' '}
          {new Date(detalle.recibido_en).toLocaleString('es-MX')}
        </p>
      </header>

      {(detalle.referencia_entrega || detalle.nota) && (
        <div className="card mb-4 space-y-1">
          {detalle.referencia_entrega && (
            <p className="text-sm">
              <span className="text-gray-500">Referencia:</span> {detalle.referencia_entrega}
            </p>
          )}
          {detalle.nota && (
            <p className="text-sm">
              <span className="text-gray-500">Nota:</span> {detalle.nota}
            </p>
          )}
        </div>
      )}

      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Renglones
      </h2>
      <div className="space-y-2 mb-4">
        {detalle.items.map((item) => (
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
              {Number(item.orden_item?.cantidad ?? 0)}{' '}
              {item.orden_item?.material?.unidad_medida}
            </p>
            {item.observacion && (
              <p className="text-xs text-amber-800 mt-2">{item.observacion}</p>
            )}
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
            <p className="text-gray-600 mt-1">{detalle.nota_revision}</p>
          )}
        </div>
      )}

      {puedeRevisar && (
        <Link
          href={`/recepciones/${detalle.id}/revisar`}
          className="block w-full text-center rounded-xl bg-[#132A45] text-white font-semibold py-3"
        >
          Revisar checklist
        </Link>
      )}

      {detalle.orden?.id && (
        <Link
          href={`/ordenes/${detalle.orden.id}/recibir`}
          className="block w-full text-center mt-3 rounded-xl border border-gray-300 font-semibold py-3 text-sm"
        >
          Registrar otra recepción de esta OC
        </Link>
      )}
    </main>
  )
}
