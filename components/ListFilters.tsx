import Link from 'next/link'
import { IconSearch } from '@/components/icons'
import { PAGE_SIZE, pageHref, type ListParams } from '@/lib/list-filters'
import { cn } from '@/lib/utils'

function filterHref(path: string, params: ListParams, patch: Partial<ListParams>): string {
  const next: ListParams = { ...params, ...patch, pagina: '1' }
  const query = new URLSearchParams()
  for (const key of ['q', 'estatus', 'desde', 'hasta', 'proyecto', 'obra'] as const) {
    const value = next[key]
    if (value) query.set(key, value)
  }
  const qs = query.toString()
  return qs ? `${path}?${qs}` : path
}

function labelEstatusChip(estatus: string): string {
  return estatus.replaceAll('_', ' ')
}

const chipClass = (active: boolean) =>
  cn(
    'shrink-0 inline-flex min-h-[36px] items-center rounded-md px-3 text-xs sm:text-sm font-medium capitalize transition-all select-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    active
      ? 'bg-card text-foreground shadow-xs font-semibold'
      : 'text-muted-foreground hover:text-foreground hover:bg-card/40'
  )

const labelClass = 'block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5'

export function ListFilters({
  path,
  params,
  statuses,
  searchLabel,
  obras,
  hideEstatus = false,
  estatusAsChips = false,
  compact = false,
}: {
  path: string
  params: ListParams
  statuses: readonly string[]
  searchLabel: string
  obras?: { id: string; nombre: string }[]
  hideEstatus?: boolean
  /** Chips horizontales de estatus (móvil/oficina) en lugar del select del formulario */
  estatusAsChips?: boolean
  /** Toolbar densa: menos aire, labels chicos (colas de oficina) */
  compact?: boolean
}) {
  const showChipBar = estatusAsChips && !hideEstatus
  const currentEstatus = statuses.includes(params.estatus ?? '')
    ? (params.estatus as string)
    : ''
  const hayFiltros = Boolean(params.q || params.desde || params.hasta || params.obra || params.proyecto)

  return (
    <div className={compact ? 'mb-4 space-y-2.5' : 'mb-5 space-y-3'}>
      {showChipBar && (
        <div className="overflow-x-auto rounded-lg bg-muted p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <nav
            className="flex shrink-0 items-center gap-0.5"
            aria-label="Filtrar por estatus"
          >
            <Link
              href={filterHref(path, params, { estatus: undefined })}
              aria-current={!currentEstatus ? 'page' : undefined}
              className={chipClass(!currentEstatus)}
            >
              Todos
            </Link>
            {statuses.map((s) => {
              const active = currentEstatus === s
              return (
                <Link
                  key={s}
                  href={filterHref(path, params, { estatus: s })}
                  aria-current={active ? 'page' : undefined}
                  className={chipClass(active)}
                >
                  {labelEstatusChip(s)}
                </Link>
              )
            })}
          </nav>
        </div>
      )}

      <form
        action={path}
        className={cn(
          'card',
          compact
            ? 'grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end'
            : 'grid grid-cols-1 gap-4 p-4 sm:grid-cols-2'
        )}
      >
        <label
          className={cn(
            compact ? 'lg:col-span-4' : '',
            showChipBar && !compact ? 'sm:col-span-2' : ''
          )}
        >
          <span className={labelClass}>{searchLabel}</span>
          <span className="relative block">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className={cn('input-base pl-9', compact && 'min-h-[40px] py-2 text-sm')}
              name="q"
              defaultValue={params.q}
              maxLength={100}
              type="search"
              placeholder="Buscar…"
            />
          </span>
        </label>
        {!hideEstatus && !estatusAsChips && (
          <label className={compact ? 'lg:col-span-2' : ''}>
            <span className={labelClass}>Estatus</span>
            <select
              className={cn('input-base capitalize', compact && 'min-h-[40px] py-2 text-sm')}
              name="estatus"
              defaultValue={params.estatus ?? ''}
            >
              <option value="">Todos</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
        )}
        {(hideEstatus || estatusAsChips) && params.estatus ? (
          <input type="hidden" name="estatus" value={params.estatus} />
        ) : null}
        {obras && obras.length > 0 && (
          <label
            className={cn(
              compact ? 'lg:col-span-3' : '',
              hideEstatus || estatusAsChips || compact ? '' : 'sm:col-span-2'
            )}
          >
            <span className={labelClass}>Proyecto</span>
            <select
              className={cn('input-base', compact && 'min-h-[40px] py-2 text-sm')}
              name="obra"
              defaultValue={params.obra ?? ''}
            >
              <option value="">Todos los proyectos</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={compact ? 'lg:col-span-2' : ''}>
          <span className={labelClass}>Desde</span>
          <input
            className={cn('input-base', compact && 'min-h-[40px] py-2 text-sm')}
            type="date"
            name="desde"
            defaultValue={params.desde}
          />
        </label>
        <label className={compact ? 'lg:col-span-2' : ''}>
          <span className={labelClass}>Hasta</span>
          <input
            className={cn('input-base', compact && 'min-h-[40px] py-2 text-sm')}
            type="date"
            name="hasta"
            defaultValue={params.hasta}
          />
        </label>
        {path === '/ordenes' && (
          <label className={compact ? 'lg:col-span-4' : 'sm:col-span-2'}>
            <span className={labelClass}>Proyecto</span>
            <input
              className={cn('input-base', compact && 'min-h-[40px] py-2 text-sm')}
              name="proyecto"
              defaultValue={params.proyecto}
              type="search"
              maxLength={100}
            />
          </label>
        )}
        <div
          className={cn(
            'flex flex-wrap items-center gap-2',
            compact ? 'lg:col-span-12 lg:justify-end' : 'sm:col-span-2'
          )}
        >
          {hayFiltros && (
            <Link className={compact ? 'btn-ghost btn-sm' : 'btn-ghost'} href={path}>
              Limpiar
            </Link>
          )}
          <button className={compact ? 'btn-secondary btn-sm' : 'btn-secondary'} type="submit">
            Aplicar filtros
          </button>
        </div>
      </form>
    </div>
  )
}

export function ListPagination({
  path,
  params,
  page,
  total,
}: {
  path: string
  params: ListParams
  page: number
  total: number
}) {
  const desde = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const hasta = Math.min(page * PAGE_SIZE, total)
  return (
    <nav aria-label="Paginación" className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground tabular-nums">
        {total === 0
          ? 'Sin resultados'
          : `${desde}–${hasta} de ${total} resultado${total === 1 ? '' : 's'}`}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link className="btn-secondary btn-sm" href={pageHref(path, params, page - 1)}>
            Anterior
          </Link>
        ) : (
          <span className="btn-secondary btn-sm pointer-events-none opacity-50" aria-disabled>
            Anterior
          </span>
        )}
        {page * PAGE_SIZE < total ? (
          <Link className="btn-secondary btn-sm" href={pageHref(path, params, page + 1)}>
            Siguiente
          </Link>
        ) : (
          <span className="btn-secondary btn-sm pointer-events-none opacity-50" aria-disabled>
            Siguiente
          </span>
        )}
      </div>
    </nav>
  )
}
