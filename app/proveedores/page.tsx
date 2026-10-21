import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { FilterTabs } from '@/components/FilterTabs'
import { IconDocumento, IconPlus, IconSearch, IconTelefono, IconWhatsApp } from '@/components/icons'
import { getSessionUsuario } from '@/lib/auth/session'
import { enlaceLlamar, enlaceWhatsApp, filtrarProveedores } from '@/lib/proveedores-lista'
import { puedeGestionarProveedores, puedeVerPrecios } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { Proveedor } from '@/lib/types'

const COLUMNAS = 'lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_9rem_6rem_14rem]'

export default async function ProveedoresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; estatus?: string | string[] }>
}) {
  const session = await getSessionUsuario()
  if (!session || !puedeVerPrecios(session.rol)) {
    redirect('/')
  }
  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q : ''
  const soloActivos = params.estatus === 'activos'

  const puedeGestionar = puedeGestionarProveedores(session.rol)
  const supabase = await createClient()
  const { data: proveedores, error } = await supabase
    .from('proveedores')
    .select('id, nombre, contacto, telefono, activo, creado_en')
    .order('nombre')

  const todos = (proveedores as Proveedor[] | null) ?? []
  const lista = filtrarProveedores(todos, q, soloActivos ? 'activos' : 'todos')
  const filtrando = q.trim() !== '' || soloActivos
  const hrefEstatus = (estatus: 'todos' | 'activos') => {
    const consulta = new URLSearchParams()
    if (q.trim()) consulta.set('q', q.trim())
    if (estatus === 'activos') consulta.set('estatus', 'activos')
    const texto = consulta.toString()
    return texto ? `/proveedores?${texto}` : '/proveedores'
  }
  const nuevo = puedeGestionar
    ? { label: 'Nuevo proveedor', href: '/proveedores/nuevo', icon: IconPlus }
    : undefined

  return (
    <main className="page-shell">
      <PageHeader
        title="Proveedores"
        description="Directorio de proveedores autorizados para órdenes de compra."
        backHref="/ordenes"
        backLabel="Órdenes"
        action={nuevo}
      />

      {error && (
        <div className="card border-danger/40 bg-danger-soft text-danger-soft-foreground mb-4">
          No se pudieron cargar los proveedores.
        </div>
      )}

      {todos.length > 0 && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <form action="/proveedores" method="get" role="search" className="flex flex-1 items-end gap-2">
            {soloActivos && <input type="hidden" name="estatus" value="activos" />}
            <div className="flex-1">
              <label htmlFor="buscar-proveedor" className="field-label">
                Buscar proveedor
              </label>
              <input
                id="buscar-proveedor"
                name="q"
                type="search"
                defaultValue={q}
                placeholder="Nombre o teléfono"
                className="input-base"
              />
            </div>
            <button type="submit" className="btn-secondary">
              <IconSearch className="h-4 w-4" />
              <span>Buscar</span>
            </button>
          </form>
          <FilterTabs
            ariaLabel="Estatus del proveedor"
            className="sm:w-56"
            tabs={[
              { key: 'todos', label: 'Todos', active: !soloActivos, href: hrefEstatus('todos') },
              { key: 'activos', label: 'Activos', active: soloActivos, href: hrefEstatus('activos') },
            ]}
          />
        </div>
      )}

      {todos.length === 0 && !error ? (
        <EmptyState
          icon={IconDocumento}
          title="No hay proveedores registrados"
          description="Agrega los proveedores autorizados para compras y cotizaciones."
          action={nuevo}
        />
      ) : lista.length === 0 && filtrando ? (
        <div className="flex flex-col items-center gap-4">
          <EmptyState
            className="w-full"
            icon={IconSearch}
            title="Ningún proveedor coincide"
            description="Prueba con otro nombre o quita el filtro de estatus."
          />
          <Link href="/proveedores" className="btn-secondary">
            Limpiar filtros
          </Link>
        </div>
      ) : (
        <div className="list-stack">
          <div className={`list-header ${COLUMNAS}`}>
            <span>Proveedor</span>
            <span>Contacto</span>
            <span>Teléfono</span>
            <span>Estatus</span>
            <span />
          </div>
          {lista.map((p) => {
            const llamar = enlaceLlamar(p.telefono)
            const whatsapp = enlaceWhatsApp(p.telefono)
            const nombre = (
              <span className="truncate text-base font-semibold text-foreground group-hover:text-primary lg:text-sm">
                {p.nombre}
              </span>
            )
            return (
              <div
                key={p.id}
                className={`group relative flex flex-col gap-3 px-4 py-3 lg:grid lg:items-center lg:gap-3 ${COLUMNAS}`}
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex items-start justify-between gap-2">
                    {puedeGestionar ? (
                      <Link
                        href={`/proveedores/${p.id}`}
                        className="flex min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring after:absolute after:inset-0 after:content-['']"
                      >
                        {nombre}
                      </Link>
                    ) : (
                      <span className="flex min-w-0">{nombre}</span>
                    )}
                    {!p.activo && (
                      <Badge variant="neutral" className="lg:hidden">
                        Inactivo
                      </Badge>
                    )}
                  </div>
                  {p.contacto && (
                    <p className="truncate text-sm text-muted-foreground lg:hidden">{p.contacto}</p>
                  )}
                  {p.telefono && (
                    <p className="text-sm tabular-nums text-muted-foreground lg:hidden">{p.telefono}</p>
                  )}
                </div>
                <p className="hidden min-w-0 truncate text-sm text-muted-foreground lg:block">
                  {p.contacto || '—'}
                </p>
                <p className="hidden text-sm tabular-nums text-muted-foreground lg:block">
                  {p.telefono || '—'}
                </p>
                <div className="hidden lg:block">
                  <Badge variant={p.activo ? 'success' : 'neutral'} dot={p.activo}>
                    {p.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                <div className="relative z-10 flex gap-2 lg:justify-end">
                  {llamar && (
                    <a href={llamar} className="btn-secondary flex-1 lg:flex-none">
                      <IconTelefono className="h-4 w-4" />
                      <span>Llamar</span>
                    </a>
                  )}
                  {whatsapp && (
                    <a
                      href={whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary flex-1 lg:flex-none"
                    >
                      <IconWhatsApp className="h-4 w-4" />
                      <span>WhatsApp</span>
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
