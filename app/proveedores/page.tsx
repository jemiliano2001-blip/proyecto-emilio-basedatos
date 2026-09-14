import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { IconPlus, IconDocumento } from '@/components/icons'
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
  const supabase = await createClient()
  const { data: proveedores, error } = await supabase
    .from('proveedores')
    .select('id, nombre, contacto, telefono, activo, creado_en')
    .order('nombre')

  const lista = (proveedores as Proveedor[] | null) ?? []

  return (
    <main className="page-shell">
      <PageHeader
        title="Proveedores"
        backHref="/ordenes"
        backLabel="Órdenes"
        action={
          puedeGestionar
            ? {
                label: 'Nuevo proveedor',
                href: '/proveedores/nuevo',
                icon: IconPlus,
              }
            : undefined
        }
      />

      {error && (
        <div className="card border-red-300 bg-red-50 text-red-700 mb-4">
          No se pudieron cargar los proveedores.
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
        {lista.map((p) => (
          <Link
            key={p.id}
            href={puedeGestionar ? `/proveedores/${p.id}` : '#'}
            className={
              puedeGestionar
                ? 'flex min-h-[56px] items-start justify-between gap-3 px-3.5 py-3 hover:bg-slate-50 transition-colors'
                : 'flex min-h-[56px] items-start justify-between gap-3 px-3.5 py-3'
            }
          >
            <div className="min-w-0">
              <p className="font-semibold text-ink">{p.nombre}</p>
              {(p.contacto || p.telefono) && (
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {[p.contacto, p.telefono].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            {!p.activo && <Badge variant="gray">Inactivo</Badge>}
          </Link>
        ))}
        {lista.length === 0 && !error && (
          <div className="p-4">
            <EmptyState
              icon={IconDocumento}
              title="No hay proveedores registrados"
              description="Agrega los proveedores autorizados para compras y cotizaciones."
              action={
                puedeGestionar
                  ? {
                      label: 'Nuevo proveedor',
                      href: '/proveedores/nuevo',
                      icon: IconPlus,
                    }
                  : undefined
              }
            />
          </div>
        )}
      </div>
    </main>
  )
}
