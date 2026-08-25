import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarProveedores, puedeVerPrecios } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { Proveedor } from '@/lib/types'

export default async function ProveedoresPage() {
  const session = await getSessionUsuario()
  if (!session || !puedeVerPrecios(session.rol)) {
    redirect('/')
  }

  const puedeGestionar = puedeGestionarProveedores(session.rol)
  const supabase = createClient()
  const { data: proveedores, error } = await supabase
    .from('proveedores')
    .select('id, nombre, contacto, telefono, activo, creado_en')
    .order('nombre')

  return (
    <main className="page-shell">
      <header className="mb-6 pt-4 flex items-start justify-between gap-3">
        <div>
          <Link href="/ordenes" className="text-sm text-[#1E7F7A] font-medium">
            ← Órdenes
          </Link>
          <h1 className="text-2xl font-bold text-[#132A45] mt-2">Proveedores</h1>
        </div>
        {puedeGestionar && (
          <Link href="/proveedores/nuevo" className="btn-primary shrink-0 text-sm py-2 px-4">
            Nuevo
          </Link>
        )}
      </header>

      {error && (
        <div className="card border-red-300 bg-red-50 text-red-700 mb-4">
          No se pudieron cargar los proveedores.
        </div>
      )}

      <div className="space-y-3">
        {(proveedores as Proveedor[] | null)?.map((p) => (
          <Link
            key={p.id}
            href={puedeGestionar ? `/proveedores/${p.id}` : '#'}
            className="card block"
          >
            <div className="flex justify-between items-start gap-2">
              <div>
                <p className="font-semibold">{p.nombre}</p>
                {p.contacto && <p className="text-sm text-gray-500">{p.contacto}</p>}
                {p.telefono && <p className="text-xs text-gray-400">{p.telefono}</p>}
              </div>
              {!p.activo && (
                <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-1">
                  Inactivo
                </span>
              )}
            </div>
          </Link>
        ))}
        {proveedores?.length === 0 && (
          <p className="text-gray-500 text-center py-8">No hay proveedores todavía.</p>
        )}
      </div>
    </main>
  )
}
