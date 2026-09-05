import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/Badge'
import {
  AprobarComprasButton,
  AprobarPagoButton,
  RechazarSolicitudForm,
} from '@/components/AprobarRequisicion'
import { CancelarSolicitudButton } from '@/components/CancelarSolicitudButton'
import { getSessionUsuario } from '@/lib/auth/session'
import { formatMoneyMx } from '@/lib/money'
import {
  puedeAprobarCompras,
  puedeAprobarPago,
  puedeCotizar,
} from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { labelTipoLinea } from '@/lib/validations/solicitud'
import type { EstadoSolicitud, TipoLineaSolicitud } from '@/lib/types'

interface SolicitudDetalle {
  id: string
  estado: EstadoSolicitud
  nota: string | null
  creado_en: string
  solicitante_id: string
  obra: { id: string; nombre: string; fraccionamiento: string | null } | null
  solicitante: { nombre: string } | null
  items: {
    id: string
    tipo_linea: TipoLineaSolicitud | null
    cantidad_solicitada: number | null
    descripcion: string | null
    monto_mxn: number | null
    nota: string | null
    obra_id: string | null
    item_obra: { nombre: string } | null
    material: {
      nombre_base: string
      variante: string | null
      unidad_medida: string
    } | null
  }[]
}

interface OrdenRelacionada {
  id: string
  folio: string
  total: number
  obra: { nombre: string } | null
}

function badgeVariant(estado: EstadoSolicitud): 'red' | 'teal' | 'navy' | 'amber' {
  switch (estado) {
    case 'cancelada':
    case 'rechazada':
      return 'red'
    case 'finalizada':
    case 'aprobada':
      return 'teal'
    case 'en_proceso':
    case 'en_cotizacion':
      return 'navy'
    default:
      return 'amber'
  }
}

function labelEstado(estado: EstadoSolicitud) {
  switch (estado) {
    case 'en_proceso':
      return 'en proceso'
    case 'en_cotizacion':
      return 'en cotización'
    case 'pendiente':
      return 'recibida'
    case 'aprobada':
      return 'finalizada'
    default:
      return estado
  }
}

export default async function SolicitudDetallePage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getSessionUsuario()
  const supabase = createClient()

  const { data: solicitud } = await supabase
    .from('solicitudes_material')
    .select(
      `id, estado, nota, creado_en, solicitante_id,
       obra:obras(id, nombre, fraccionamiento),
       solicitante:usuarios(nombre),
       items:solicitud_items(
         id, tipo_linea, cantidad_solicitada, descripcion, monto_mxn, nota, obra_id,
         material:catalogo_materiales(nombre_base, variante, unidad_medida),
         item_obra:obras!solicitud_items_obra_id_fkey(nombre)
       )`
    )
    .eq('id', params.id)
    .maybeSingle()

  if (!solicitud) notFound()

  const detalle = solicitud as unknown as SolicitudDetalle
  const esMultiObra = (detalle.items ?? []).some((i) => i.obra_id)

  const { data: ordenesData } =
    detalle.estado === 'finalizada'
      ? await supabase
          .from('ordenes_compra')
          .select('id, folio, total, obra:obras(nombre)')
          .eq('solicitud_id', params.id)
      : { data: null }
  const ordenesRelacionadas = (ordenesData as unknown as OrdenRelacionada[] | null) ?? []
  const esDueno = session?.perfil?.id === detalle.solicitante_id
  const estadoRecibida =
    detalle.estado === 'recibida' || detalle.estado === 'pendiente'
  const estadoProceso =
    detalle.estado === 'en_proceso' || detalle.estado === 'en_cotizacion'
  const puedeCancelar =
    session?.rol === 'acceso_total' || (esDueno && estadoRecibida)
  const puedeCompras =
    puedeAprobarCompras(session?.rol ?? null) && estadoRecibida
  const puedeFinanzas =
    puedeAprobarPago(session?.rol ?? null) && detalle.estado === 'en_proceso'
  const puedeRechazar = puedeCompras || puedeFinanzas
  const mostrarCotizarLegacy =
    puedeCotizar(session?.rol ?? null) &&
    (detalle.estado === 'pendiente' ||
      detalle.estado === 'en_cotizacion' ||
      detalle.estado === 'aprobada')

  return (
    <main className="page-shell">
      <PageHeader
        title={detalle.obra?.nombre ?? 'Proyecto'}
        description={
          <div>
            {detalle.obra?.fraccionamiento && (
              <p className="text-gray-500 text-sm">{detalle.obra.fraccionamiento}</p>
            )}
            <p className="text-xs text-muted mt-1">
              {detalle.solicitante?.nombre ? `${detalle.solicitante.nombre} · ` : ''}
              {new Date(detalle.creado_en).toLocaleString('es-MX')}
            </p>
          </div>
        }
        backHref="/solicitudes"
        backLabel="Solicitudes"
        badge={
          <Badge variant={badgeVariant(detalle.estado)}>
            {labelEstado(detalle.estado)}
          </Badge>
        }
      />

      {detalle.nota && (
        <div className="card mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
            Nota
          </p>
          <p className="text-sm text-gray-700">{detalle.nota}</p>
        </div>
      )}

      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Renglones
      </h2>
      <div className="space-y-2 mb-6">
        {(detalle.items ?? []).map((item) => {
          const tipo = item.tipo_linea ?? 'material'
          return (
            <div key={item.id} className="card">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">
                {labelTipoLinea(tipo)}
              </p>
              {esMultiObra && item.item_obra && (
                <p className="text-xs font-semibold text-teal-700 mb-1">
                  Proyecto: {item.item_obra.nombre}
                </p>
              )}
              {tipo === 'material' ? (
                <div className="flex justify-between items-baseline">
                  <p className="font-medium">
                    {item.material?.nombre_base}
                    {item.material?.variante && (
                      <span className="text-gray-500"> · {item.material.variante}</span>
                    )}
                  </p>
                  <span className="text-sm text-gray-500">
                    {item.cantidad_solicitada} {item.material?.unidad_medida}
                  </span>
                </div>
              ) : (
                <div className="flex justify-between items-baseline">
                  <p className="font-medium">{item.descripcion}</p>
                  {item.monto_mxn != null && (
                    <span className="text-sm text-gray-500">
                      {formatMoneyMx(Number(item.monto_mxn))}
                    </span>
                  )}
                </div>
              )}
              {tipo === 'material' && item.monto_mxn != null && (
                <p className="text-xs text-gray-500 mt-1">
                  Monto: {formatMoneyMx(Number(item.monto_mxn))}
                </p>
              )}
              {item.nota && <p className="text-xs text-gray-400 mt-1">{item.nota}</p>}
            </div>
          )
        })}
      </div>

      {ordenesRelacionadas.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Órdenes de compra generadas
          </h2>
          <div className="space-y-2">
            {ordenesRelacionadas.map((oc) => (
              <Link key={oc.id} href={`/ordenes/${oc.id}`} className="card block">
                <div className="flex justify-between">
                  <span className="font-medium">{oc.folio}</span>
                  <span className="text-sm text-gray-500">{oc.obra?.nombre}</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{formatMoneyMx(Number(oc.total))}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {puedeCompras && <AprobarComprasButton solicitudId={detalle.id} />}
        {puedeFinanzas && <AprobarPagoButton solicitudId={detalle.id} />}
        {puedeRechazar && <RechazarSolicitudForm solicitudId={detalle.id} />}
        {mostrarCotizarLegacy && (
          <Link
            href={`/solicitudes/${detalle.id}/cotizar`}
            className="btn-secondary w-full text-center block text-sm"
          >
            Cotizar (flujo anterior)
          </Link>
        )}
        {puedeCancelar && <CancelarSolicitudButton solicitudId={detalle.id} />}
      </div>

      {estadoProceso && (
        <p className="text-xs text-gray-400 text-center mt-4">
          Aprobada por Compras — pendiente de pago en Finanzas.
        </p>
      )}
    </main>
  )
}
