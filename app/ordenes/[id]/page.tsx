import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeCapturarRecepcion, puedeVerPrecios } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'

interface OrdenDetalle {
  id: string
  folio: string
  total: number
  moneda: string
  estado: string
  creado_en: string
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
      `id, folio, total, moneda, estado, creado_en,
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

  return (
    <main className="max-w-2xl mx-auto p-4 pb-28">
      <header className="mb-6 pt-4">
        <Link href="/ordenes" className="text-sm text-[#1E7F7A] font-medium">
          ← Órdenes
        </Link>
        <h1 className="text-2xl font-bold text-[#132A45] mt-2">{detalle.folio}</h1>
        <p className="text-gray-500 text-sm">{detalle.obra?.nombre}</p>
        {detalle.obra?.fraccionamiento && (
          <p className="text-xs text-gray-400">{detalle.obra.fraccionamiento}</p>
        )}
        <p className="text-xs text-gray-400 mt-1 capitalize">
          Estado: {detalle.estado.replaceAll('_', ' ')}
        </p>
      </header>

      {puedeRecibir && (
        <Link
          href={`/ordenes/${detalle.id}/recibir`}
          className="block w-full text-center mb-4 rounded-xl bg-[#1E7F7A] text-white font-semibold py-3"
        >
          Registrar recepción
        </Link>
      )}

      <div className="card mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
          Proveedor
        </p>
        <p className="font-medium">{detalle.proveedor?.nombre}</p>
        {detalle.proveedor?.contacto && (
          <p className="text-sm text-gray-500">{detalle.proveedor.contacto}</p>
        )}
        {detalle.proveedor?.telefono && (
          <p className="text-sm text-gray-500">{detalle.proveedor.telefono}</p>
        )}
      </div>

      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Renglones
      </h2>
      <div className="space-y-2 mb-4">
        {detalle.items.map((item) => {
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
                  {r.estado.replaceAll('_', ' ')}
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
