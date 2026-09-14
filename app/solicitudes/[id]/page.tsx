import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/Badge'
import { CopyButton } from '@/components/CopyButton'
import {
  AprobarComprasButton,
  AprobarPagoButton,
  RechazarSolicitudForm,
} from '@/components/AprobarRequisicion'
import { CancelarSolicitudButton } from '@/components/CancelarSolicitudButton'
import {
  SolicitudesWorkbenchNav,
  type SolicitudNavRow,
} from '@/components/SolicitudesWorkbenchNav'
import { getSessionUsuario } from '@/lib/auth/session'
import { formatMoneyMx } from '@/lib/money'
import {
  puedeAprobarCompras,
  puedeAprobarPago,
  puedeCotizar,
  puedeVerPrecios,
  puedeVerTodasLasSolicitudes,
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
      precio_base: number | null
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
  params: Promise<{ id: string }>
}) {
  const resolvedparams = await params
  const session = await getSessionUsuario()
  const supabase = await createClient()

  const { data: solicitud } = await supabase
    .from('solicitudes_material')
    .select(
      `id, estado, nota, creado_en, solicitante_id,
       obra:obras(id, nombre, fraccionamiento),
       solicitante:usuarios(nombre),
       items:solicitud_items(
         id, tipo_linea, cantidad_solicitada, descripcion, monto_mxn, nota, obra_id,
         material:catalogo_materiales(nombre_base, variante, unidad_medida, precio_base),
         item_obra:obras!solicitud_items_obra_id_fkey(nombre)
       )`
    )
    .eq('id', resolvedparams.id)
    .maybeSingle()

  if (!solicitud) notFound()

  const detalle = solicitud as unknown as SolicitudDetalle
  const esMultiObra = (detalle.items ?? []).some((i) => i.obra_id)

  const { data: ordenesData } =
    detalle.estado === 'finalizada'
      ? await supabase
          .from('ordenes_compra')
          .select('id, folio, total, obra:obras(nombre)')
          .eq('solicitud_id', resolvedparams.id)
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
  const verPrecios = puedeVerPrecios(session?.rol ?? null)
  const fechaVisible = new Date(detalle.creado_en).toLocaleString('es-MX', {
    dateStyle: 'long',
    timeStyle: 'short',
  })
  const materialesParaAprobar = (detalle.items ?? [])
    .filter((i) => (i.tipo_linea ?? 'material') === 'material' && i.material)
    .map((i) => {
      const cant = Number(i.cantidad_solicitada ?? 0)
      const monto = i.monto_mxn != null ? Number(i.monto_mxn) : null
      return {
        id: i.id,
        nombre:
          `${i.material!.nombre_base}${i.material!.variante ? ` · ${i.material!.variante}` : ''}`,
        cantidad: cant,
        unidad: i.material!.unidad_medida,
        precioBase:
          i.material!.precio_base != null ? Number(i.material!.precio_base) : null,
        precioUnitarioActual:
          monto != null && cant > 0 ? Math.round((monto / cant) * 100) / 100 : null,
      }
    })

  const verTodas = puedeVerTodasLasSolicitudes(session?.rol ?? null)
  let colaQuery = supabase
    .from('solicitudes_material')
    .select('id, estado, creado_en, obra:obras(nombre)')
    .order('creado_en', { ascending: false })
    .limit(40)
  if (!verTodas && session?.perfil?.id) {
    colaQuery = colaQuery.eq('solicitante_id', session.perfil.id)
  }
  const { data: colaData } = await colaQuery
  const colaNav: SolicitudNavRow[] = (
    (colaData as unknown as {
      id: string
      estado: EstadoSolicitud
      creado_en: string
      obra: { nombre: string } | null
    }[] | null) ?? []
  ).map((s) => ({
    id: s.id,
    estado: s.estado,
    creado_en: s.creado_en,
    obraNombre: s.obra?.nombre ?? 'Proyecto',
  }))

  return (
    <main className="page-shell">
      <div className="lg:flex lg:items-start lg:gap-5">
        <SolicitudesWorkbenchNav items={colaNav} activeId={detalle.id} />

        <div className="min-w-0 flex-1">
      <PageHeader
        title={detalle.obra?.nombre ?? 'Proyecto'}
        description={
          <div>
            {detalle.obra?.fraccionamiento && (
              <p className="text-gray-500 text-sm">{detalle.obra.fraccionamiento}</p>
            )}
            <p className="text-sm font-semibold text-ink mt-2">{fechaVisible}</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-muted">
                {detalle.solicitante?.nombre ? `${detalle.solicitante.nombre}` : 'Solicitante'}
              </p>
              <CopyButton text={detalle.id} label="Copiar ID" className="text-[11px]" />
            </div>
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
        Materiales
      </h2>
      <div className="card mb-6 divide-y divide-gray-100 p-0 overflow-hidden">
        {(detalle.items ?? []).map((item) => {
          const tipo = item.tipo_linea ?? 'material'
          return (
            <div key={item.id} className="p-3 sm:p-4 space-y-1">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">
                {labelTipoLinea(tipo)}
              </p>
              {esMultiObra && item.item_obra && (
                <p className="text-xs font-semibold text-teal-700 mb-1">
                  Proyecto: {item.item_obra.nombre}
                </p>
              )}
              {tipo === 'material' ? (
                <div className="flex justify-between items-baseline gap-3">
                  <p className="font-medium">
                    {item.material?.nombre_base}
                    {item.material?.variante && (
                      <span className="text-gray-500"> · {item.material.variante}</span>
                    )}
                  </p>
                  <span className="text-sm text-gray-500 shrink-0">
                    {item.cantidad_solicitada} {item.material?.unidad_medida}
                  </span>
                </div>
              ) : (
                <div className="flex justify-between items-baseline gap-3">
                  <p className="font-medium">{item.descripcion}</p>
                  {verPrecios && item.monto_mxn != null && (
                    <span className="text-sm text-gray-500 shrink-0">
                      {formatMoneyMx(Number(item.monto_mxn))}
                    </span>
                  )}
                </div>
              )}
              {verPrecios && tipo === 'material' && (
                <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                  {item.material?.precio_base != null &&
                    Number(item.material.precio_base) > 0 && (
                      <p>
                        Precio base ref.:{' '}
                        {formatMoneyMx(Number(item.material.precio_base))} /{' '}
                        {item.material.unidad_medida}
                      </p>
                    )}
                  {item.monto_mxn != null && Number(item.monto_mxn) > 0 && (
                    <p>
                      Cotizado:{' '}
                      {formatMoneyMx(
                        Number(item.cantidad_solicitada) > 0
                          ? Number(item.monto_mxn) / Number(item.cantidad_solicitada)
                          : Number(item.monto_mxn)
                      )}{' '}
                      / {item.material?.unidad_medida} · Total{' '}
                      {formatMoneyMx(Number(item.monto_mxn))}
                    </p>
                  )}
                </div>
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

      <div className="space-y-3 mt-2 lg:sticky lg:bottom-4 lg:z-10 lg:rounded-xl lg:border lg:border-gray-200 lg:bg-white/95 lg:backdrop-blur-sm lg:p-3 lg:shadow-sm">
        {(puedeCompras || puedeFinanzas || verPrecios) && (
          <Link
            href={`/solicitudes/${detalle.id}/formato`}
            className="btn-secondary w-full text-center block text-sm"
          >
            Ver plantilla OC (imprimir)
          </Link>
        )}
        {puedeCompras && (
          <AprobarComprasButton
            solicitudId={detalle.id}
            materiales={materialesParaAprobar}
          />
        )}
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
        </div>
      </div>
    </main>
  )
}
