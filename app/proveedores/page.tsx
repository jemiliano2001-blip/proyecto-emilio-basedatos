import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { IconChevron, IconDocumento, IconPlus } from '@/components/icons'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarProveedores, puedeVerPrecios } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { Proveedor } from '@/lib/types'
import { cn } from '@/lib/utils'

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
        description="Directorio de proveedores autorizados para órdenes de compra."
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
        <div className="card border-danger/40 bg-danger-soft text-danger-soft-foreground mb-4">
          No se pudieron cargar los proveedores.
        </div>
      )}

      {lista.length === 0 && !error ? (
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
      ) : (
        <div className="list-stack">
          <div className="list-header lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_9rem_6rem_1.5rem]">
            <span>Proveedor</span>
            <span>Contacto</span>
            <span>Teléfono</span>
            <span>Estatus</span>
            <span />
          </div>
          {lista.map((p) => {
            const rowClass = cn(
              'group flex min-h-[56px] items-center justify-between gap-3 px-4 py-3 lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_9rem_6rem_1.5rem] lg:gap-3',
              puedeGestionar &&
                'transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'
            )
            const inner = (
              <>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary">{p.nombre}</p>
                  {(p.contacto || p.telefono) && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground lg:hidden">
                      {[p.contacto, p.telefono].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <p className="hidden min-w-0 truncate text-sm text-muted-foreground lg:block">{p.contacto || '—'}</p>
                <p className="hidden text-sm tabular-nums text-muted-foreground lg:block">{p.telefono || '—'}</p>
                <div className="shrink-0">
                  {p.activo ? (
                    <Badge variant="success" dot className="hidden lg:inline-flex">
                      Activo
                    </Badge>
                  ) : (
                    <Badge variant="neutral">Inactivo</Badge>
                  )}
                </div>
                {puedeGestionar ? (
                  <IconChevron className="hidden size-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary lg:block" />
                ) : (
                  <span />
                )}
              </>
            )
            return puedeGestionar ? (
              <Link key={p.id} href={`/proveedores/${p.id}`} className={rowClass}>
                {inner}
              </Link>
            ) : (
              <div key={p.id} className={rowClass}>
                {inner}
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
