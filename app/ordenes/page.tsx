import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeVerPrecios } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'

interface OrdenRow {
  id: string
  folio: string
  total: number
  moneda: string
  estado: string
  creado_en: string
  obra: { nombre: string } | null
  proveedor: { nombre: string } | null
}

export default async function OrdenesPage() {
  const session = await getSessionUsuario()
  if (!session || !puedeVerPrecios(session.rol)) {
    redirect('/')
  }

  const supabase = createClient()
  const { data: ordenes, error } = await supabase
    .from('ordenes_compra')
    .select(
      'id, folio, total, moneda, estado, creado_en, obra:obras(nombre), proveedor:proveedores(nombre)'
    )
    .order('creado_en', { ascending: false })

  return (
    <main className="max-w-2xl mx-auto p-4 pb-28">
      <header className="mb-6 pt-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#132A45]">Órdenes de compra</h1>
          <p className="text-gray-500 text-sm">Emitidas desde cotizaciones aprobadas</p>
        </div>
        <Link href="/proveedores" className="text-sm font-semibold text-[#1E7F7A] shrink-0 pt-1">
          Proveedores
        </Link>
      </header>

      {error && (
        <div className="card border-red-300 bg-red-50 text-red-700 mb-4">
          No se pudieron cargar las órdenes.
        </div>
      )}

      <div className="space-y-3">
        {(ordenes as unknown as OrdenRow[] | null)?.map((o) => (
          <Link key={o.id} href={`/ordenes/${o.id}`} className="card block">
            <div className="flex justify-between items-start gap-2">
              <div>
                <p className="font-semibold">{o.folio}</p>
                <p className="text-sm text-gray-500">{o.obra?.nombre}</p>
                <p className="text-xs text-gray-400">{o.proveedor?.nombre}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold">
                  {Number(o.total).toFixed(2)} {o.moneda}
                </p>
                <span className="text-xs capitalize text-gray-500">{o.estado}</span>
              </div>
            </div>
          </Link>
        ))}
        {ordenes?.length === 0 && (
          <p className="text-gray-500 text-center py-8">
            Todavía no hay órdenes. Cotiza una solicitud pendiente para emitir la primera.
          </p>
        )}
      </div>
    </main>
  )
}
