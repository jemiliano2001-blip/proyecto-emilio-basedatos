export type ListParams = { pagina?: string; q?: string; estatus?: string; desde?: string; hasta?: string; proyecto?: string }
export const PAGE_SIZE = 25

export function listFilters(params: ListParams, statuses: readonly string[]) {
  const page = /^\d{1,6}$/.test(params.pagina ?? '') ? Math.max(1, Number(params.pagina)) : 1
  const date = (value?: string) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().startsWith(value) ? value : ''
  const clean = (value?: string) => (value ?? '').replace(/[%_,().]/g, ' ').trim().slice(0, 100)
  return { page, from: (page - 1) * PAGE_SIZE, to: page * PAGE_SIZE - 1,
    q: clean(params.q), proyecto: clean(params.proyecto),
    estatus: statuses.includes(params.estatus ?? '') ? params.estatus! : '',
    desde: date(params.desde), hasta: date(params.hasta) }
}

export function pageHref(path: string, params: ListParams, page: number) {
  const query = new URLSearchParams()
  for (const key of ['q', 'estatus', 'desde', 'hasta', 'proyecto'] as const) {
    if (params[key]) query.set(key, params[key]!)
  }
  query.set('pagina', String(page))
  return `${path}?${query}`
}
