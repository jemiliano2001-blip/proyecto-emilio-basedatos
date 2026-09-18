import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/Badge'
import { CopyButton } from '@/components/CopyButton'
import { EmptyState } from '@/components/EmptyState'
import { IconChevron, IconImprimir, IconPaquete } from '@/components/icons'
import { OrdenCompraFacturasSection } from '@/components/OrdenCompraFacturasSection'
import { OrdenCompraProveedorModal } from '@/components/OrdenCompraProveedorModal'
import { getSessionUsuario } from '@/lib/auth/session'
import { formatMoneyMx } from '@/lib/money'
import {
  puedeAsignarProveedorOC,
  puedeCapturarRecepcion,
  puedeGestionarFacturasOC,
  puedeVerPrecios,
} from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { OrdenCompraFactura } from '@/lib/types'

interface OrdenDetalle {
  id: string
  folio: string
  folio_fisico?: string | null
  total: number
  moneda: string
  estado: string
  creado_en: string
  obra_id: string
  proveedor_id: string | null
  obra: { nombre: string; fraccionamiento: string | null } | null
  proveedor: { nombre: string; contacto: string | null; telefono: string | null } | null
  items: {
    id: string
    cantidad: number
    precio_unitario: number
    subtotal: number
    material: {
      nombre_base: string
      variante: string | null
      unidad_medida: string
    } | null
  }[]
}

interface RecepcionHist {
  id: string
  estado: string
  recibido_en: string
  receptor: { nombre: string } | null
}

export default async function OrdenDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedparams = await params
  const session = await getSessionUsuario()
  if (!session || !puedeVerPrecios(session.rol)) {
    redirect('/')
  }

  const supabase = await createClient()
  const { data: orden } = await supabase
    .from('ordenes_compra')
    .select(
      `id, folio, folio_fisico, total, moneda, estado, creado_en, obra_id, proveedor_id,
       obra:obras(nombre, fraccionamiento),
       proveedor:proveedores(nombre, contacto, telefono),
       items:orden_compra_items(
         id, cantidad, precio_unitario, subtotal,
         material:catalogo_materiales(nombre_base, variante, unidad_medida)
       )`
    )
    .eq('id', resolvedparams.id)
    .maybeSingle()

  if (!orden) notFound()

  const detalle = orden as unknown as OrdenDetalle

  const { data: checklistRows } = await supabase.rpc('detalle_orden_checklist', {
    p_orden_id: resolvedparams.id,
  })

  type ChecklistRow = {
    orden_item_id: string
    cantidad_pedida: number
    cantidad_recibida_buena: number
    cantidad_danada_acum: number
    pendiente: number
  }

  const saldoMap = new Map(
    ((checklistRows ?? []) as ChecklistRow[]).map((s) => [s.orden_item_id, s])
  )

  const { data: historial } = await supabase
    .from('recepciones_material')
    .select(
      `id, estado, recibido_en,
       receptor:usuarios!recepciones_material_receptor_id_fkey(nombre)`
    )
    .eq('orden_id', resolvedparams.id)
    .order('creado_en', { ascending: false })

  const recepciones = (historial ?? []) as unknown as RecepcionHist[]
  const puedeRecibir =
    puedeCapturarRecepcion(session.rol) &&
    (detalle.estado === 'emitida' || detalle.estado === 'parcialmente_recibida')

  const puedeAsignar = puedeAsignarProveedorOC(session.rol)
  const puedeGestionarFacturas = puedeGestionarFacturasOC(session.rol)

  // Cargar lista de proveedores si el usuario puede asignar
  let proveedores: { id: string; nombre: string }[] = []
  if (puedeAsignar) {
    const { data: provs } = await supabase
      .from('proveedores')
      .select('id, nombre')
      .order('nombre')
    proveedores = (provs ?? []) as { id: string; nombre: string }[]
  }

  // Cargar facturas adjuntas + materiales ligados
  const { data: facturasData } = await supabase
    .from('orden_compra_facturas')
    .select(
      `id, orden_id, obra_id, folio_factura, monto_factura,
       archivo_path, archivo_url, archivo_nombre, tamano_bytes,
       tipo_archivo, subido_por, creado_en,
       subidor:usuarios!orden_compra_facturas_subido_por_fkey(nombre),
       items:orden_compra_factura_items(
         orden_item_id,
         orden_item:orden_compra_items(
           id, cantidad,
           material:catalogo_materiales(nombre_base, variante, unidad_medida)
         )
       )`
    )
    .eq('orden_id', resolvedparams.id)
    .order('creado_en', { ascending: false })

  type FacturaItemJoin = {
    orden_item_id: string
    orden_item: {
      id: string
      cantidad: number
      material: {
        nombre_base: string
        variante: string | null
        unidad_medida: string
      } | null
    } | null
  }

  type FacturaRow = {
    id: string
    orden_id: string
    obra_id: string
    folio_factura: string | null
    monto_factura: number | null
    archivo_path: string
    archivo_url: string
    archivo_nombre: string
    tamano_bytes: number | null
    tipo_archivo: 'pdf' | 'imagen' | 'xml' | 'otro'
    subido_por: string | null
    creado_en: string
    subidor: { nombre: string } | null
    items: FacturaItemJoin[] | null
  }

  const facturas: OrdenCompraFactura[] = (
    (facturasData ?? []) as unknown as FacturaRow[]
  ).map((f) => ({
    id: f.id,
    orden_id: f.orden_id,
    obra_id: f.obra_id,
    folio_factura: f.folio_factura,
    monto_factura: f.monto_factura,
    archivo_path: f.archivo_path,
    archivo_url: f.archivo_url,
    archivo_nombre: f.archivo_nombre,
    tamano_bytes: f.tamano_bytes,
    tipo_archivo: f.tipo_archivo,
    subido_por: f.subido_por,
    creado_en: f.creado_en,
    subido_por_nombre: f.subidor?.nombre,
    items: (f.items ?? []).map((link) => {
      const mat = link.orden_item?.material
      const nombre = mat
        ? `${mat.nombre_base}${mat.variante ? ` · ${mat.variante}` : ''}`
        : 'Material'
      return {
        orden_item_id: link.orden_item_id,
        nombre,
        cantidad: Number(link.orden_item?.cantidad ?? 0),
        unidad: mat?.unidad_medida ?? 'PZA',
      }
    }),
  }))

  const itemsParaFactura = (detalle.items ?? []).map((it) => ({
    id: it.id,
    nombre: it.material
      ? `${it.material.nombre_base}${it.material.variante ? ` · ${it.material.variante}` : ''}`
      : 'Material',
    cantidad: Number(it.cantidad),
    unidad: it.material?.unidad_medida ?? 'PZA',
  }))

  const estadoBadge = (estado: string): { variant: 'info' | 'success' | 'warning' | 'neutral'; label: string } => {
    if (estado === 'emitida') return { variant: 'info', label: 'Emitida' }
    if (estado === 'completada' || estado === 'recibida') return { variant: 'success', label: 'Recibida' }
    if (estado === 'parcialmente_recibida') return { variant: 'warning', label: 'Parcialmente recibida' }
    return { variant: 'neutral', label: estado.replaceAll('_', ' ') }
  }
  const badge = estadoBadge(detalle.estado)

  const totalPedido = (detalle.items ?? []).reduce((acc, it) => acc + Number(it.cantidad), 0)
  const totalRecibido = Array.from(saldoMap.values()).reduce(
    (acc, s) => acc + Number(s.cantidad_recibida_buena),
    0
  )
  const totalDanado = Array.from(saldoMap.values()).reduce(
    (acc, s) => acc + Number(s.cantidad_danada_acum),
    0
  )
  const pctRecibido = totalPedido > 0 ? Math.min(100, (totalRecibido / totalPedido) * 100) : 0
  const fechaEmision = new Date(detalle.creado_en).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  return (
    <main className="page-shell-wide">
      <PageHeader
        eyebrow={`Orden de compra · ${fechaEmision}`}
        title={
          <span className="inline-flex items-center gap-2">
            <span className="tabular-nums">{detalle.folio}</span>
            <CopyButton text={detalle.folio} label="Copiar folio" />
          </span>
        }
        badge={
          <Badge variant={badge.variant} dot>
            {badge.label}
          </Badge>
        }
        description={
          detalle.obra
            ? [detalle.obra.nombre, detalle.obra.fraccionamiento].filter(Boolean).join(' · ')
            : undefined
        }
        backHref="/ordenes"
        backLabel="Órdenes"
        actions={
          <>
            <Link href={`/ordenes/${detalle.id}/formato`} className="btn-secondary btn-sm">
              <IconImprimir className="size-4" />
              Formato OC (PDF)
            </Link>
            {puedeRecibir && (
              <Link href={`/ordenes/${detalle.id}/recibir`} className="btn-primary btn-sm">
                <IconPaquete className="size-4" />
                Registrar recepción
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        {/* Columna principal */}
        <div className="min-w-0 space-y-6">
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">Materiales</h2>
                <p className="text-sm text-muted-foreground">
                  {detalle.items?.length ?? 0} partida{(detalle.items?.length ?? 0) === 1 ? '' : 's'} ·{' '}
                  {detalle.moneda}
                </p>
              </div>
            </div>

            <div className="list-stack">
              <div className="list-header lg:grid-cols-[minmax(0,1fr)_8rem_8rem_7rem]">
                <span>Material</span>
                <span className="text-right">Cantidad</span>
                <span className="text-right">P. unitario</span>
                <span className="text-right">Subtotal</span>
              </div>
              {(detalle.items ?? []).map((item) => {
                const saldo = saldoMap.get(item.id)
                const pedido = Number(item.cantidad)
                const bueno = Number(saldo?.cantidad_recibida_buena ?? 0)
                const danado = Number(saldo?.cantidad_danada_acum ?? 0)
                const pendiente = Number(saldo?.pendiente ?? pedido)
                const pct = pedido > 0 ? Math.min(100, (bueno / pedido) * 100) : 0
                return (
                  <div
                    key={item.id}
                    className="px-4 py-3 lg:grid lg:grid-cols-[minmax(0,1fr)_8rem_8rem_7rem] lg:items-center lg:gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {item.material?.nombre_base ?? 'Material'}
                        {item.material?.variante ? (
                          <span className="text-muted-foreground"> · {item.material.variante}</span>
                        ) : null}
                      </p>
                      {saldo && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted" aria-hidden>
                            <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {bueno} recibido
                            {danado > 0 ? ` · ${danado} dañado` : ''}
                            {pendiente > 0 ? ` · ${pendiente} pendiente` : ''}
                          </p>
                        </div>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground tabular-nums lg:hidden">
                        {pedido} {item.material?.unidad_medida} × {formatMoneyMx(Number(item.precio_unitario))}
                      </p>
                    </div>
                    <p className="hidden text-right text-sm tabular-nums text-foreground lg:block">
                      {pedido} <span className="text-muted-foreground">{item.material?.unidad_medida}</span>
                    </p>
                    <p className="hidden text-right text-sm tabular-nums text-muted-foreground lg:block">
                      {formatMoneyMx(Number(item.precio_unitario))}
                    </p>
                    <p className="mt-1 text-right text-sm font-semibold tabular-nums text-foreground lg:mt-0">
                      {formatMoneyMx(Number(item.subtotal))}
                    </p>
                  </div>
                )
              })}
              <div className="flex items-center justify-between bg-muted/40 px-4 py-3">
                <span className="text-sm font-semibold text-foreground">Total</span>
                <span className="text-base font-semibold tabular-nums text-foreground">
                  {formatMoneyMx(Number(detalle.total))}{' '}
                  <span className="text-xs font-medium text-muted-foreground">{detalle.moneda}</span>
                </span>
              </div>
            </div>
          </section>

          {/* Facturas del proveedor (PDF e imágenes) */}
          <OrdenCompraFacturasSection
            ordenId={detalle.id}
            obraId={detalle.obra_id}
            totalOrden={Number(detalle.total)}
            moneda={detalle.moneda}
            facturas={facturas}
            items={itemsParaFactura}
            puedeGestionar={puedeGestionarFacturas}
          />

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">Historial de recepciones</h2>
            {recepciones.length === 0 ? (
              <EmptyState
                icon={IconPaquete}
                title="Aún no hay checklists"
                description={
                  puedeRecibir
                    ? 'Registra la primera recepción cuando llegue el material a obra.'
                    : undefined
                }
                action={puedeRecibir ? { label: 'Registrar recepción', href: `/ordenes/${detalle.id}/recibir` } : undefined}
              />
            ) : (
              <div className="list-stack">
                {recepciones.map((r) => (
                  <Link key={r.id} href={`/recepciones/${r.id}`} className="list-row items-center">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{r.receptor?.nombre ?? 'Receptor'}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.recibido_en).toLocaleString('es-MX')}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge
                        variant={
                          r.estado === 'aprobada'
                            ? 'success'
                            : r.estado === 'pendiente_revision'
                              ? 'warning'
                              : r.estado === 'rechazada'
                                ? 'danger'
                                : 'neutral'
                        }
                      >
                        {(r.estado ?? '').replaceAll('_', ' ')}
                      </Badge>
                      <IconChevron className="size-4 text-muted-foreground/60" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Rail derecho */}
        <aside className="space-y-4 lg:sticky lg:top-[calc(var(--topbar-height)+1.5rem)]">
          <section className="card">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="card-title">Proveedor</h2>
              {puedeAsignar && (
                <OrdenCompraProveedorModal
                  ordenId={detalle.id}
                  proveedorActualId={detalle.proveedor_id}
                  folioFisicoActual={detalle.folio_fisico}
                  proveedores={proveedores}
                />
              )}
            </div>
            <p className="text-sm font-semibold text-foreground">
              {detalle.proveedor?.nombre || (
                <span className="font-normal text-muted-foreground">Sin proveedor asignado</span>
              )}
            </p>
            {detalle.proveedor?.contacto && (
              <p className="text-sm text-muted-foreground">{detalle.proveedor.contacto}</p>
            )}
            {detalle.proveedor?.telefono && (
              <p className="text-sm text-muted-foreground tabular-nums">{detalle.proveedor.telefono}</p>
            )}
            {detalle.folio_fisico && (
              <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning-soft-foreground">
                <span>
                  Talonario: <strong className="tabular-nums">{detalle.folio_fisico}</strong>
                </span>
                <CopyButton text={detalle.folio_fisico} label="Copiar" className="py-0.5 px-1.5 text-xs" />
              </div>
            )}
          </section>

          <section className="card">
            <h2 className="card-title mb-3">Recepción</h2>
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">Recibido</span>
              <span className="font-semibold tabular-nums text-foreground">
                {totalRecibido} / {totalPedido}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full rounded-full bg-success" style={{ width: `${pctRecibido}%` }} />
            </div>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Pendiente</dt>
                <dd className="tabular-nums font-medium text-foreground">
                  {Math.max(0, totalPedido - totalRecibido - totalDanado)}
                </dd>
              </div>
              {totalDanado > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Dañado</dt>
                  <dd className="tabular-nums font-medium text-danger">{totalDanado}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Checklists</dt>
                <dd className="tabular-nums font-medium text-foreground">{recepciones.length}</dd>
              </div>
            </dl>
          </section>

          <section className="card">
            <h2 className="card-title mb-3">Resumen</h2>
            <dl className="space-y-2.5 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">Estatus</dt>
                <dd className="font-medium text-foreground">{badge.label}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">Emitida</dt>
                <dd className="font-medium text-foreground">{fechaEmision}</dd>
              </div>
              {detalle.obra && (
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Proyecto</dt>
                  <dd className="text-right font-medium text-foreground">
                    <Link href={`/obras/${detalle.obra_id}`} className="text-primary hover:underline">
                      {detalle.obra.nombre}
                    </Link>
                  </dd>
                </div>
              )}
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">Facturas</dt>
                <dd className="font-medium tabular-nums text-foreground">{facturas.length}</dd>
              </div>
              <div className="flex items-start justify-between gap-3 border-t border-border pt-2.5">
                <dt className="text-muted-foreground">Total</dt>
                <dd className="font-semibold tabular-nums text-foreground">{formatMoneyMx(Number(detalle.total))}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </main>
  )
}
