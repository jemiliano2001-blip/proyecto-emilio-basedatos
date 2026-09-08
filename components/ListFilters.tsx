import Link from 'next/link'
import { PAGE_SIZE, pageHref, type ListParams } from '@/lib/list-filters'

export function ListFilters({ path, params, statuses, searchLabel }: {
  path: string; params: ListParams; statuses: readonly string[]; searchLabel: string
}) {
  return <form action={path} className="card mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
    <label className="text-sm font-semibold">{searchLabel}<input className="input-base mt-1" name="q" defaultValue={params.q} maxLength={100} type="search" /></label>
    <label className="text-sm font-semibold">Estatus<select className="input-base mt-1" name="estatus" defaultValue={params.estatus ?? ''}>
      <option value="">Todos</option>{statuses.map(s => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}
    </select></label>
    <label className="text-sm font-semibold">Desde<input className="input-base mt-1" type="date" name="desde" defaultValue={params.desde} /></label>
    <label className="text-sm font-semibold">Hasta<input className="input-base mt-1" type="date" name="hasta" defaultValue={params.hasta} /></label>
    {path === '/ordenes' && <label className="text-sm font-semibold sm:col-span-2">Proyecto<input className="input-base mt-1" name="proyecto" defaultValue={params.proyecto} type="search" maxLength={100} /></label>}
    <div className="flex gap-4 sm:col-span-2"><button className="btn-secondary" type="submit">Filtrar</button><Link className="btn-secondary" href={path}>Limpiar filtros</Link></div>
  </form>
}

export function ListPagination({ path, params, page, total }: { path: string; params: ListParams; page: number; total: number }) {
  return <nav aria-label="Paginación" className="my-4 flex flex-wrap items-center justify-between gap-4">
    {page > 1 && <Link className="btn-secondary" href={pageHref(path, params, page - 1)}>Anterior</Link>}
    <p className="text-sm">Página {page} · {total} resultado{total === 1 ? '' : 's'}</p>
    {page * PAGE_SIZE < total && <Link className="btn-secondary" href={pageHref(path, params, page + 1)}>Siguiente</Link>}
  </nav>
}
