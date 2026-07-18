import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeVerPrecios } from '@/lib/roles'
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
        <p className="text-xs text-gray-400 mt-1 capitalize">Estado: {detalle.estado}</p>
      </header>

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
        {detalle.items.map((item) => (
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
          </div>
        ))}
      </div>

      <div className="card flex justify-between items-center">
        <span className="font-semibold">Total</span>
        <span className="text-lg font-bold text-[#132A45]">
          {Number(detalle.total).toFixed(2)} {detalle.moneda}
        </span>
      </div>
    </main>
  )
}
