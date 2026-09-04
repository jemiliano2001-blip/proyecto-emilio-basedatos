import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
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
  params: { id: string }
}) {
  const session = await getSessionUsuario()
  if (!session || !puedeVerPrecios(session.rol)) {
    redirect('/')
  }

  const supabase = createClient()
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
    .eq('id', params.id)
    .maybeSingle()

  if (!orden) notFound()

  const detalle = orden as unknown as OrdenDetalle

  const { data: checklistRows } = await supabase.rpc('detalle_orden_checklist', {
    p_orden_id: params.id,
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
    .eq('orden_id', params.id)
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

  // Cargar facturas adjuntas a la orden de compra
  const { data: facturasData } = await supabase
    .from('orden_compra_facturas')
    .select(
      `id, orden_id, obra_id, folio_factura, monto_factura,
       archivo_path, archivo_url, archivo_nombre, tamano_bytes,
       tipo_archivo, subido_por, creado_en,
       subidor:usuarios!orden_compra_facturas_subido_por_fkey(nombre)`
    )
    .eq('orden_id', params.id)
    .order('creado_en', { ascending: false })

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
  }))

  return (
    <main className="page-shell">
      <header className="mb-6 pt-4">
        <Link href="/ordenes" className="text-sm text-[#1E7F7A] font-medium">
          ← Órdenes
        </Link>
        <div className="flex items-center gap-2 mt-2">
          <h1 className="text-2xl font-bold text-[#132A45]">{detalle.folio}</h1>
          {detalle.folio_fisico && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
              Talonario: {detalle.folio_fisico}
            </span>
          )}
        </div>
        <p className="text-gray-500 text-sm">{detalle.obra?.nombre}</p>
        {detalle.obra?.fraccionamiento && (
          <p className="text-xs text-gray-400">{detalle.obra.fraccionamiento}</p>
        )}
        <p className="text-xs text-gray-400 mt-1 capitalize">
          Estado: {detalle.estado.replaceAll('_', ' ')}
        </p>
      </header>

      {/* Acciones principales: Imprimir Formato y Registrar Recepción */}
      <div className="flex flex-col sm:flex-row gap-2 mb-6">
        <Link
          href={`/ordenes/${detalle.id}/formato`}
          className="flex-1 text-center rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 font-bold py-3 text-sm flex items-center justify-center gap-2 shadow-xs transition-colors"
        >
          📄 Ver e Imprimir Formato OC (PDF)
        </Link>

        {puedeRecibir && (
          <Link
            href={`/ordenes/${detalle.id}/recibir`}
            className="flex-1 text-center rounded-xl bg-[#1E7F7A] hover:bg-[#186662] text-white font-semibold py-3 text-sm flex items-center justify-center gap-2 shadow-xs transition-colors"
          >
            📦 Registrar recepción
          </Link>
        )}
      </div>

      <div className="card mb-4">
        <div className="flex justify-between items-start mb-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
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
        <p className="font-semibold text-ink">
          {detalle.proveedor?.nombre || (
            <span className="text-gray-400 italic font-normal">Sin proveedor asignado</span>
          )}
        </p>
        {detalle.proveedor?.contacto && (
          <p className="text-sm text-gray-500">{detalle.proveedor.contacto}</p>
        )}
        {detalle.proveedor?.telefono && (
          <p className="text-sm text-gray-500">{detalle.proveedor.telefono}</p>
        )}
        {detalle.folio_fisico && (
          <p className="text-xs text-amber-800 bg-amber-50 px-2 py-0.5 rounded inline-block mt-2 border border-amber-200">
            No. Folio físico: <strong>{detalle.folio_fisico}</strong>
          </p>
        )}
      </div>

      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Renglones
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
                    <span className="text-gray-500"> · {item.material.variante}</span>
                  ) : null}
                </p>
                <span className="text-sm font-semibold shrink-0">
                  {Number(item.subtotal).toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {item.cantidad} {item.material?.unidad_medida} ×{' '}
                {Number(item.precio_unitario).toFixed(2)} {detalle.moneda}
              </p>
              {saldo && (
                <p className="text-xs text-[#1E7F7A] mt-2">
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
        <span className="text-lg font-bold text-[#132A45]">
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
        puedeGestionar={puedeGestionarFacturas}
      />

      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Historial de recepciones
      </h2>
      {recepciones.length === 0 ? (
        <div className="card text-sm text-gray-600">Aún no hay checklists.</div>
      ) : (
        <div className="space-y-2">
          {recepciones.map((r) => (
            <Link
              key={r.id}
              href={`/recepciones/${r.id}`}
              className="card block hover:bg-gray-50"
            >
              <div className="flex justify-between gap-2">
                <p className="text-sm font-medium">{r.receptor?.nombre ?? 'Receptor'}</p>
                <span className="text-xs text-gray-500 capitalize">
                  {(r.estado ?? '').replaceAll('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(r.recibido_en).toLocaleString('es-MX')}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
