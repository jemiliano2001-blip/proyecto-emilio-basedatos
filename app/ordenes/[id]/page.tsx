import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/Badge'
import { CopyButton } from '@/components/CopyButton'
import { IconImprimir, IconPaquete } from '@/components/icons'
import { OrdenCompraFacturasSection } from '@/components/OrdenCompraFacturasSection'
import { OrdenCompraProveedorModal } from '@/components/OrdenCompraProveedorModal'
import { getSessionUsuario } from '@/lib/auth/session'
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

  return (
    <main className="page-shell">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            <span>{detalle.folio}</span>
            <CopyButton text={detalle.folio} label="Copiar folio" />
          </span>
        }
        badge={
          <div className="flex items-center gap-1.5 flex-wrap">
            {detalle.folio_fisico && (
              <span className="badge-amber inline-flex items-center gap-1">
                <span>Talonario: {detalle.folio_fisico}</span>
                <CopyButton text={detalle.folio_fisico} label="Copiar talonario" className="py-0.5 px-1.5 text-xs" />
              </span>
            )}
            <Badge
              variant={
                detalle.estado === 'emitida'
                  ? 'navy'
                  : detalle.estado === 'completada' || detalle.estado === 'recibida'
                  ? 'teal'
                  : detalle.estado === 'parcialmente_recibida'
                  ? 'amber'
                  : 'gray'
              }
            >
              {detalle.estado.replaceAll('_', ' ')}
            </Badge>
          </div>
        }
        description={
          <div>
            <p className="text-sm font-medium text-foreground">{detalle.obra?.nombre}</p>
            {detalle.obra?.fraccionamiento && (
              <p className="text-xs text-muted-foreground">{detalle.obra.fraccionamiento}</p>
            )}
          </div>
        }
        backHref="/ordenes"
        backLabel="Órdenes"
      />

      {/* Acciones principales: Imprimir Formato y Registrar Recepción */}
      <div className="flex flex-col sm:flex-row gap-2 mb-6 -mt-2">
        <Link
          href={`/ordenes/${detalle.id}/formato`}
          className="flex-1 text-center rounded-xl bg-warning-soft hover:bg-warning-soft text-warning-soft-foreground border border-warning/40 font-bold py-3 text-sm flex items-center justify-center gap-2 shadow-xs transition-colors"
        >
          <IconImprimir className="w-4 h-4" />
          <span>Ver e Imprimir Formato OC (PDF)</span>
        </Link>

        {puedeRecibir && (
          <Link
            href={`/ordenes/${detalle.id}/recibir`}
            className="btn-primary flex-1 py-3 text-sm flex items-center justify-center gap-2"
          >
            <IconPaquete className="w-4 h-4" />
            <span>Registrar recepción</span>
          </Link>
        )}
      </div>

      <div className="card mb-4">
        <div className="flex justify-between items-start mb-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Proveedor
          </p>
          {puedeAsignar && (
            <OrdenCompraProveedorModal
              ordenId={detalle.id}
              proveedorActualId={detalle.proveedor_id}
              folioFisicoActual={detalle.folio_fisico}
              proveedores={proveedores}
            />
          )}
        </div>
        <p className="font-semibold text-foreground">
          {detalle.proveedor?.nombre || (
            <span className="text-muted-foreground italic font-normal">Sin proveedor asignado</span>
          )}
        </p>
        {detalle.proveedor?.contacto && (
          <p className="text-sm text-muted-foreground">{detalle.proveedor.contacto}</p>
        )}
        {detalle.proveedor?.telefono && (
          <p className="text-sm text-muted-foreground">{detalle.proveedor.telefono}</p>
        )}
        {detalle.folio_fisico && (
          <p className="text-xs text-warning-soft-foreground bg-warning-soft px-2 py-0.5 rounded inline-block mt-2 border border-warning/30">
            No. Folio físico: <strong>{detalle.folio_fisico}</strong>
          </p>
        )}
      </div>

      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        Materiales
      </h2>
      <div className="space-y-2 mb-4">
        {(detalle.items ?? []).map((item) => {
          const saldo = saldoMap.get(item.id)
          return (
            <div key={item.id} className="card">
              <div className="flex justify-between items-baseline gap-2">
                <p className="font-medium text-sm">
                  {item.material?.nombre_base}
                  {item.material?.variante ? (
                    <span className="text-muted-foreground"> · {item.material.variante}</span>
                  ) : null}
                </p>
                <span className="text-sm font-semibold shrink-0">
                  {Number(item.subtotal).toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {item.cantidad} {item.material?.unidad_medida} ×{' '}
                {Number(item.precio_unitario).toFixed(2)} {detalle.moneda}
              </p>
              {saldo && (
                <p className="text-xs text-primary mt-2">
                  Recibido bueno {Number(saldo.cantidad_recibida_buena)} · Dañado{' '}
                  {Number(saldo.cantidad_danada_acum)} · Pendiente{' '}
                  {Number(saldo.pendiente)}
                </p>
              )}
            </div>
          )
        })}
      </div>

      <div className="card flex justify-between items-center mb-6">
        <span className="font-semibold">Total</span>
        <span className="text-lg font-bold text-foreground">
          {Number(detalle.total).toFixed(2)} {detalle.moneda}
        </span>
      </div>

      {/* Sección de Facturas del Proveedor (PDF e Imágenes) */}
      <OrdenCompraFacturasSection
        ordenId={detalle.id}
        obraId={detalle.obra_id}
        totalOrden={Number(detalle.total)}
        moneda={detalle.moneda}
        facturas={facturas}
        items={itemsParaFactura}
        puedeGestionar={puedeGestionarFacturas}
      />

      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        Historial de recepciones
      </h2>
      {recepciones.length === 0 ? (
        <div className="card text-sm text-muted-foreground">Aún no hay checklists.</div>
      ) : (
        <div className="space-y-2">
          {recepciones.map((r) => (
            <Link
              key={r.id}
              href={`/recepciones/${r.id}`}
              className="card block hover:bg-muted/50"
            >
              <div className="flex justify-between gap-2">
                <p className="text-sm font-medium">{r.receptor?.nombre ?? 'Receptor'}</p>
                <span className="text-xs text-muted-foreground capitalize">
                  {(r.estado ?? '').replaceAll('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(r.recibido_en).toLocaleString('es-MX')}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
