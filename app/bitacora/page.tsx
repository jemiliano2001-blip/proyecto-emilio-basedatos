import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { IconBitacora } from '@/components/icons'
import {
  ACCIONES_BITACORA,
  etiquetaAccionAuditoria,
  etiquetaTablaAuditoria,
} from '@/lib/auditoria-labels'
import { getSessionUsuario } from '@/lib/auth/session'
import { PAGE_SIZE, listFilters, pageHref, type ListParams } from '@/lib/list-filters'
import { puedeVerBitacora } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { AuditoriaEvento } from '@/lib/types'

function formatearFecha(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export default async function BitacoraPage({
  searchParams,
}: {
  searchParams: Promise<ListParams>
}) {
  const session = await getSessionUsuario()
  if (!session || !puedeVerBitacora(session.rol)) {
    redirect('/')
  }

  const rawParams = await searchParams
  const filters = listFilters(rawParams, ACCIONES_BITACORA)
  const params: ListParams = {
    q: filters.q || undefined,
    estatus: filters.estatus || undefined,
    desde: filters.desde || undefined,
    hasta: filters.hasta || undefined,
    proyecto: filters.proyecto || undefined,
    pagina: String(filters.page),
  }

  const supabase = await createClient()
  let query = supabase
    .from('auditoria')
    .select(
      'id, tabla, registro_id, usuario_id, accion, datos_antes, datos_despues, creado_en, usuario:usuarios(id, nombre, email)',
      { count: 'exact' }
    )
    .order('creado_en', { ascending: false })
    .range(filters.from, filters.to)

  if (filters.estatus) {
    query = query.eq('accion', filters.estatus)
  }
  if (filters.proyecto) {
    query = query.eq('tabla', filters.proyecto)
  }
  if (filters.desde) {
    query = query.gte('creado_en', `${filters.desde}T00:00:00.000Z`)
  }
  if (filters.hasta) {
    query = query.lte('creado_en', `${filters.hasta}T23:59:59.999Z`)
  }
  if (filters.q) {
    query = query.ilike('tabla', `%${filters.q}%`)
  }

  const { data, error, count } = await query
  const eventos = (data as unknown as AuditoriaEvento[] | null) ?? []
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Tablas distintas vistas recientemente (para el select); fallback a lista fija si falla
  const { data: tablasRows } = await supabase
    .from('auditoria')
    .select('tabla')
    .order('creado_en', { ascending: false })
    .limit(200)

  const tablasOpciones = Array.from(
    new Set((tablasRows ?? []).map((r: { tabla: string }) => r.tabla))
  ).sort()

  return (
    <main className="page-shell">
      <PageHeader
        title="Bitácora"
        description="Registro de cambios en datos sensibles. Solo lectura."
      />

      <form
        method="get"
        className="mb-4 space-y-3 rounded-xl border border-border bg-card p-3.5"
      >
        <div>
          <label htmlFor="q" className="block text-xs font-semibold text-muted-foreground mb-1">
            Buscar
          </label>
          <input
            id="q"
            name="q"
            defaultValue={params.q ?? ''}
            className="input-base"
            placeholder="Tabla o id de registro"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="estatus" className="block text-xs font-semibold text-muted-foreground mb-1">
              Acción
            </label>
            <select
              id="estatus"
              name="estatus"
              defaultValue={params.estatus ?? ''}
              className="input-base"
            >
              <option value="">Todas</option>
              {ACCIONES_BITACORA.map((a) => (
                <option key={a} value={a}>
                  {etiquetaAccionAuditoria(a)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="proyecto" className="block text-xs font-semibold text-muted-foreground mb-1">
              Sección
            </label>
            <select
              id="proyecto"
              name="proyecto"
              defaultValue={params.proyecto ?? ''}
              className="input-base"
            >
              <option value="">Todas</option>
              {tablasOpciones.map((t) => (
                <option key={t} value={t}>
                  {etiquetaTablaAuditoria(t)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="desde" className="block text-xs font-semibold text-muted-foreground mb-1">
              Desde
            </label>
            <input
              id="desde"
              name="desde"
              type="date"
              defaultValue={params.desde ?? ''}
              className="input-base"
            />
          </div>
          <div>
            <label htmlFor="hasta" className="block text-xs font-semibold text-muted-foreground mb-1">
              Hasta
            </label>
            <input
              id="hasta"
              name="hasta"
              type="date"
              defaultValue={params.hasta ?? ''}
              className="input-base"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-primary btn-sm min-h-[44px]">
            Filtrar
          </button>
          <Link
            href="/bitacora"
            className="inline-flex min-h-[44px] items-center rounded-lg border border-border px-4 text-sm font-semibold text-muted-foreground hover:bg-muted/50"
          >
            Limpiar
          </Link>
        </div>
      </form>

      {error && (
        <div className="card border-danger/40 bg-danger-soft text-danger-soft-foreground mb-4">
          No se pudo cargar la bitácora.
        </div>
      )}

      <div className="list-stack">
        {eventos.map((ev) => {
          const nombre =
            ev.usuario && typeof ev.usuario === 'object' && 'nombre' in ev.usuario
              ? (ev.usuario as { nombre: string }).nombre
              : 'Sistema'
          return (
            <Link
              key={ev.id}
              href={`/bitacora/${ev.id}`}
              className="flex min-h-[56px] items-start justify-between gap-3 px-3.5 py-3 hover:bg-muted/50 transition-colors"
            >
              <div className="min-w-0">
                <p className="font-semibold text-foreground">
                  {etiquetaAccionAuditoria(ev.accion)} · {etiquetaTablaAuditoria(ev.tabla)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {nombre} · {formatearFecha(ev.creado_en)}
                </p>
              </div>
              <Badge
                variant={
                  ev.accion === 'DELETE'
                    ? 'red'
                    : ev.accion === 'INSERT'
                      ? 'teal'
                      : 'gray'
                }
              >
                {etiquetaAccionAuditoria(ev.accion)}
              </Badge>
            </Link>
          )
        })}
        {eventos.length === 0 && !error && (
          <div className="p-4">
            <EmptyState
              icon={IconBitacora}
              title="Sin eventos"
              description="No hay registros con estos filtros."
            />
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <nav
          className="mt-4 flex items-center justify-between gap-3 text-sm"
          aria-label="Paginación"
        >
          <span className="text-muted-foreground">
            Página {filters.page} de {totalPages}
          </span>
          <div className="flex gap-2">
            {filters.page > 1 && (
              <Link
                href={pageHref('/bitacora', params, filters.page - 1)}
                className="min-h-[44px] inline-flex items-center rounded-lg border border-border px-3 font-semibold hover:bg-muted/50"
              >
                Anterior
              </Link>
            )}
            {filters.page < totalPages && (
              <Link
                href={pageHref('/bitacora', params, filters.page + 1)}
                className="min-h-[44px] inline-flex items-center rounded-lg border border-border px-3 font-semibold hover:bg-muted/50"
              >
                Siguiente
              </Link>
            )}
          </div>
        </nav>
      )}

    </main>
  )
}
