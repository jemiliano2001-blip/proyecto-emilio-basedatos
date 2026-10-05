import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/Badge'
import { CopyButton } from '@/components/CopyButton'
import { StepperAbastecimiento } from '@/components/StepperAbastecimiento'
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
    proveedor_id?: string | null
    item_obra: { nombre: string } | null
    proveedor?: { id: string; nombre: string } | null
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

  let solicitud: unknown = null
  const { data: solDataWithProv, error: errWithProv } = await supabase
    .from('solicitudes_material')
    .select(
      `id, estado, nota, creado_en, solicitante_id,
       obra:obras(id, nombre, fraccionamiento),
       solicitante:usuarios(nombre),
       items:solicitud_items_lectura(
         id, tipo_linea, cantidad_solicitada, descripcion, monto_mxn, nota, obra_id, proveedor_id,
         material:catalogo_materiales_lectura(nombre_base, variante, unidad_medida, precio_base),
         item_obra:obras!solicitud_items_obra_id_fkey(nombre),
         proveedor:proveedores(id, nombre)
       )`
    )
    .eq('id', resolvedparams.id)
    .maybeSingle()

  if (!errWithProv && solDataWithProv) {
    solicitud = solDataWithProv
  } else {
    const { data: solDataFallback } = await supabase
      .from('solicitudes_material')
      .select(
        `id, estado, nota, creado_en, solicitante_id,
         obra:obras(id, nombre, fraccionamiento),
         solicitante:usuarios(nombre),
         items:solicitud_items_lectura(
           id, tipo_linea, cantidad_solicitada, descripcion, monto_mxn, nota, obra_id,
           material:catalogo_materiales_lectura(nombre_base, variante, unidad_medida, precio_base),
           item_obra:obras!solicitud_items_obra_id_fkey(nombre)
         )`
      )
      .eq('id', resolvedparams.id)
      .maybeSingle()
    solicitud = solDataFallback
  }

  if (!solicitud) notFound()

  const { data: proveedoresData } = await supabase
    .from('proveedores')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre')
  const proveedores = proveedoresData ?? []

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
  const verPrecios = puedeVerPrecios(session?.rol ?? null)
  const fechaVisible = new Date(detalle.creado_en).toLocaleString('es-MX', {
    dateStyle: 'long',
    timeStyle: 'short',
  })
  const materialesParaAprobar = (detalle.items ?? [])
    .map((i) => {
      const esServicio = (i.tipo_linea ?? 'material') !== 'material'
      const cant = Number(i.cantidad_solicitada ?? 0)
      const monto = i.monto_mxn != null ? Number(i.monto_mxn) : null
      return {
        id: i.id,
        nombre:
          esServicio ? `${i.tipo_linea}: ${i.descripcion ?? 'Servicio'}` : `${i.material?.nombre_base ?? 'Material'}${i.material?.variante ? ` · ${i.material.variante}` : ''}`,
        cantidad: cant,
        unidad: i.material?.unidad_medida ?? 'servicio',
        precioBase:
          i.material?.precio_base != null ? Number(i.material.precio_base) : null,
        precioUnitarioActual:
          esServicio ? monto : monto != null && cant > 0 ? Math.round((monto / cant) * 100) / 100 : null,
        proveedorId: i.proveedor_id ?? null,
        esServicio,
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
              <p className="text-muted-foreground text-sm">{detalle.obra.fraccionamiento}</p>
            )}
            <p className="text-sm font-semibold text-foreground mt-2">{fechaVisible}</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-foreground font-medium">
                Solicitado por: <span className="font-semibold">{detalle.solicitante?.nombre ?? 'Residente de obra'}</span>
              </p>
              <span className="text-muted-foreground">·</span>
              <CopyButton text={detalle.id} label="Copiar ID" className="text-[11px]" />
            </div>
          </div>
        }
        backHref="/solicitudes"
        backLabel="Solicitudes de compra"
        badge={
          <Badge variant={badgeVariant(detalle.estado)}>
            {labelEstado(detalle.estado)}
          </Badge>
        }
      />

      <div className="mb-4">
        <StepperAbastecimiento
          pasos={[
            {
              id: 'paso-req',
              titulo: '1. Requisición',
              subtitulo: 'Captura en campo',
              fecha: new Date(detalle.creado_en).toLocaleDateString('es-MX', {
                day: '2-digit',
                month: 'short',
              }),
              responsable: detalle.solicitante?.nombre ?? 'Residente',
              estado:
                detalle.estado === 'cancelada' || detalle.estado === 'rechazada'
                  ? 'rechazado'
                  : 'completado',
            },
            {
              id: 'paso-cot',
              titulo: '2. Cotización',
              subtitulo: 'Revisión y proveedor',
              responsable: 'Compras (Talía)',
              estado:
                detalle.estado === 'cancelada' || detalle.estado === 'rechazada'
                  ? 'rechazado'
                  : estadoRecibida
                    ? 'en_proceso'
                    : 'completado',
            },
            {
              id: 'paso-oc',
              titulo: '3. Orden y Pago',
              subtitulo: 'Autorización formal',
              responsable: 'Finanzas (Blanquita)',
              estado:
                detalle.estado === 'cancelada' || detalle.estado === 'rechazada'
                  ? 'rechazado'
                  : estadoRecibida
                    ? 'pendiente'
                    : estadoProceso
                      ? 'en_proceso'
                      : 'completado',
              enlaceHref:
                ordenesRelacionadas.length > 0
                  ? `/ordenes/${ordenesRelacionadas[0].id}`
                  : null,
              enlaceTexto:
                ordenesRelacionadas.length > 0
                  ? `Ver ${ordenesRelacionadas[0].folio}`
                  : null,
            },
            {
              id: 'paso-rec',
              titulo: '4. Recepción',
              subtitulo: 'Cotejo en obra',
              responsable: 'Personal en Obra',
              estado:
                detalle.estado === 'cancelada' || detalle.estado === 'rechazada'
                  ? 'rechazado'
                  : detalle.estado === 'finalizada'
                    ? 'en_proceso'
                    : 'pendiente',
              enlaceHref:
                ordenesRelacionadas.length > 0
                  ? `/ordenes/${ordenesRelacionadas[0].id}/recibir`
                  : null,
              enlaceTexto:
                ordenesRelacionadas.length > 0 ? 'Ir a recepción' : null,
            },
          ]}
        />
      </div>

      {detalle.nota && (
        <div className="card mb-5 border-border/80 bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Nota
          </p>
          <p className="text-sm text-foreground leading-relaxed">{detalle.nota}</p>
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Partidas solicitadas
          </h2>
          <span className="text-xs text-muted-foreground">
            {(detalle.items ?? []).length} {((detalle.items ?? []).length === 1) ? 'concepto' : 'conceptos'}
          </span>
        </div>
        <div className="card divide-y divide-border/60 p-0 overflow-hidden shadow-xs">
          {(detalle.items ?? []).map((item) => {
            const tipo = item.tipo_linea ?? 'material'
            return (
              <div key={item.id} className="p-3.5 sm:p-4 space-y-1.5 transition-colors hover:bg-muted/20">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={tipo === 'material' ? 'neutral' : 'info'} className="text-[10px] uppercase font-semibold">
                    {labelTipoLinea(tipo)}
                  </Badge>
                  {esMultiObra && item.item_obra && (
                    <span className="text-xs font-semibold text-primary">
                      Proyecto: {item.item_obra.nombre}
                    </span>
                  )}
                </div>
                {tipo === 'material' ? (
                  <div className="flex justify-between items-baseline gap-3">
                    <p className="font-semibold text-foreground text-sm">
                      {item.material?.nombre_base}
                      {item.material?.variante && (
                        <span className="text-muted-foreground font-normal"> · {item.material.variante}</span>
                      )}
                    </p>
                    <span className="text-xs font-semibold font-mono bg-muted/70 px-2 py-0.5 rounded text-foreground shrink-0 tabular-nums">
                      {item.cantidad_solicitada} {item.material?.unidad_medida}
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between items-baseline gap-3">
                    <p className="font-semibold text-foreground text-sm">{item.descripcion}</p>
                    {verPrecios && item.monto_mxn != null && (
                      <span className="text-sm font-semibold text-foreground shrink-0 tabular-nums">
                        {formatMoneyMx(Number(item.monto_mxn))}
                      </span>
                    )}
                  </div>
                )}
                {verPrecios && tipo === 'material' && (
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5 pt-0.5">
                    {item.material?.precio_base != null &&
                      Number(item.material.precio_base) > 0 && (
                        <p className="tabular-nums">
                          Precio catálogo ref.:{' '}
                          <span className="font-medium text-foreground">{formatMoneyMx(Number(item.material.precio_base))}</span> /{' '}
                          {item.material.unidad_medida}
                        </p>
                      )}
                    {item.monto_mxn != null && Number(item.monto_mxn) > 0 && (
                      <p className="tabular-nums">
                        Cotizado:{' '}
                        <span className="font-medium text-foreground">
                          {formatMoneyMx(
                            Number(item.cantidad_solicitada) > 0
                              ? Number(item.monto_mxn) / Number(item.cantidad_solicitada)
                              : Number(item.monto_mxn)
                          )}
                        </span>{' '}
                        / {item.material?.unidad_medida} · Total{' '}
                        <span className="font-semibold text-foreground">{formatMoneyMx(Number(item.monto_mxn))}</span>
                      </p>
                    )}
                    {item.proveedor && (
                      <p className="text-primary font-medium">
                        Proveedor asignado: {item.proveedor.nombre}
                      </p>
                    )}
                  </div>
                )}
                {item.nota && <p className="text-xs text-muted-foreground mt-1 italic">{item.nota}</p>}
              </div>
            )
          })}
        </div>
      </div>

      {ordenesRelacionadas.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
            Órdenes de compra generadas
          </h2>
          <div className="space-y-2">
            {ordenesRelacionadas.map((oc) => (
              <Link key={oc.id} href={`/ordenes/${oc.id}`} className="card-interactive block p-3.5">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-foreground text-sm font-mono">{oc.folio}</span>
                  <span className="text-xs text-muted-foreground">{oc.obra?.nombre}</span>
                </div>
                <p className="text-sm font-bold text-foreground mt-1 tabular-nums">{formatMoneyMx(Number(oc.total))}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3 mt-4 lg:sticky lg:bottom-4 lg:z-10 lg:rounded-xl lg:border lg:border-border/80 lg:bg-card/95 lg:backdrop-blur-md lg:p-4 lg:shadow-elevated">
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
            proveedores={proveedores}
          />
        )}
        {puedeFinanzas && <AprobarPagoButton solicitudId={detalle.id} />}
        {puedeRechazar && <RechazarSolicitudForm solicitudId={detalle.id} />}
        {puedeCancelar && <CancelarSolicitudButton solicitudId={detalle.id} />}
      </div>

      {estadoProceso && (
        <p className="text-xs text-muted-foreground text-center mt-4">
          Aprobada por Compras — pendiente de pago en Finanzas.
        </p>
      )}
      {detalle.estado === 'finalizada' && <p className="text-xs text-muted-foreground text-center mt-4">Finalizada indica pago aprobado y órdenes de compra emitidas. La recepción física y la instalación se consultan por separado.</p>}
        </div>
      </div>
    </main>
  )
}
