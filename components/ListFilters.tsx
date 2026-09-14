import Link from 'next/link'
import { PAGE_SIZE, pageHref, type ListParams } from '@/lib/list-filters'

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
  [
    'shrink-0 inline-flex min-h-[44px] items-center rounded-full px-3.5 text-sm transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
    active
      ? 'font-bold bg-ink text-white'
      : 'font-semibold bg-white text-gray-600 border border-gray-200 hover:border-gray-300',
  ].join(' ')

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

  return (
    <div className={compact ? 'mb-3 space-y-2' : 'mb-4 space-y-3'}>
      {showChipBar && (
        <nav
          className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1"
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
      )}

      <form
        action={path}
        className={
          compact
            ? 'rounded-xl border border-gray-200 bg-white p-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 lg:items-end'
            : 'card grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4'
        }
      >
        <label
          className={`font-semibold text-ink ${
            compact ? 'text-xs lg:col-span-2' : 'text-sm'
          } ${showChipBar && !compact ? 'sm:col-span-2' : ''}`}
        >
          <span className={compact ? 'text-[11px] uppercase tracking-wide text-gray-500' : undefined}>
            {searchLabel}
          </span>
          <input
            className="input-base mt-1"
            name="q"
            defaultValue={params.q}
            maxLength={100}
            type="search"
          />
        </label>
        {!hideEstatus && !estatusAsChips && (
          <label className={compact ? 'text-xs font-semibold text-ink' : 'text-sm font-semibold'}>
            <span className={compact ? 'text-[11px] uppercase tracking-wide text-gray-500' : undefined}>
              Estatus
            </span>
            <select className="input-base mt-1" name="estatus" defaultValue={params.estatus ?? ''}>
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
            className={`${compact ? 'text-xs font-semibold text-ink' : 'text-sm font-semibold'} ${
              hideEstatus || estatusAsChips || compact ? '' : 'sm:col-span-2'
            }`}
          >
            <span className={compact ? 'text-[11px] uppercase tracking-wide text-gray-500' : undefined}>
              Proyecto
            </span>
            <select className="input-base mt-1" name="obra" defaultValue={params.obra ?? ''}>
              <option value="">Todos los proyectos</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={compact ? 'text-xs font-semibold text-ink' : 'text-sm font-semibold'}>
          <span className={compact ? 'text-[11px] uppercase tracking-wide text-gray-500' : undefined}>
            Desde
          </span>
          <input className="input-base mt-1" type="date" name="desde" defaultValue={params.desde} />
        </label>
        <label className={compact ? 'text-xs font-semibold text-ink' : 'text-sm font-semibold'}>
          <span className={compact ? 'text-[11px] uppercase tracking-wide text-gray-500' : undefined}>
            Hasta
          </span>
          <input className="input-base mt-1" type="date" name="hasta" defaultValue={params.hasta} />
        </label>
        {path === '/ordenes' && (
          <label
            className={`${compact ? 'text-xs font-semibold text-ink lg:col-span-2' : 'text-sm font-semibold sm:col-span-2'}`}
          >
            <span className={compact ? 'text-[11px] uppercase tracking-wide text-gray-500' : undefined}>
              Proyecto
            </span>
            <input
              className="input-base mt-1"
              name="proyecto"
              defaultValue={params.proyecto}
              type="search"
              maxLength={100}
            />
          </label>
        )}
        <div
          className={`flex flex-wrap gap-2 ${
            compact ? 'lg:col-span-4 pt-0.5' : 'sm:col-span-2'
          }`}
        >
          <button className={compact ? 'btn-primary text-sm px-4 py-2' : 'btn-secondary'} type="submit">
            Filtrar
          </button>
          <Link className={compact ? 'btn-secondary text-sm px-4 py-2' : 'btn-secondary'} href={path}>
            Limpiar filtros
          </Link>
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
  return (
    <nav aria-label="Paginación" className="my-4 flex flex-wrap items-center justify-between gap-4">
      {page > 1 && (
        <Link className="btn-secondary" href={pageHref(path, params, page - 1)}>
          Anterior
        </Link>
      )}
      <p className="text-sm text-gray-600">
        Página {page} · {total} resultado{total === 1 ? '' : 's'}
      </p>
      {page * PAGE_SIZE < total && (
        <Link className="btn-secondary" href={pageHref(path, params, page + 1)}>
          Siguiente
        </Link>
      )}
    </nav>
  )
}
