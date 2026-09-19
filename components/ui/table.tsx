'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto rounded-2xl border border-border/80 bg-card shadow-card">
      <table
        ref={ref}
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  )
)
Table.displayName = 'Table'

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('[&_tr]:border-b border-border/70 bg-amber-50/40 text-stone-800', className)} {...props} />
))
TableHeader.displayName = 'TableHeader'

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('[&_tr:last-child]:border-0 divide-y divide-border/50', className)}
    {...props}
  />
))
TableBody.displayName = 'TableBody'

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      'border-t border-border bg-muted/60 font-medium text-foreground [&>tr]:last:border-b-0',
      className
    )}
    {...props}
  />
))
TableFooter.displayName = 'TableFooter'

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        'border-b border-border/60 transition-colors duration-150 hover:bg-amber-50/20 data-[state=selected]:bg-primary-soft/60',
        className
      )}
      {...props}
    />
  )
)
TableRow.displayName = 'TableRow'

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-11 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-muted-foreground',
      className
    )}
    {...props}
  />
))
TableHead.displayName = 'TableHead'

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn('px-4 py-3.5 align-middle text-sm text-foreground tabular-nums', className)}
    {...props}
  />
))
TableCell.displayName = 'TableCell'

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn('mt-4 text-sm text-muted-foreground', className)}
    {...props}
  />
))
TableCaption.displayName = 'TableCaption'

export interface ColumnDef<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
}

export interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  keyExtractor: (item: T) => string
  pageSize?: number
  selectable?: boolean
  onActionClick?: (item: T) => void
  emptyMessage?: string
  className?: string
}

export function DataTable<T extends object>({
  data,
  columns,
  keyExtractor,
  pageSize = 5,
  selectable = true,
  onActionClick,
  emptyMessage = 'No se encontraron registros.',
  className,
}: DataTableProps<T>) {
  const [selectedKeys, setSelectedKeys] = React.useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = React.useState<string | null>(null)
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = React.useState(1)

  // Ordenamiento
  const sortedData = React.useMemo(() => {
    if (!sortKey) return data
    return [...data].sort((a, b) => {
      const valA = (a as Record<string, unknown>)[sortKey]
      const valB = (b as Record<string, unknown>)[sortKey]
      if (valA === valB) return 0
      if (valA === null || valA === undefined) return 1
      if (valB === null || valB === undefined) return -1

      const result = String(valA).localeCompare(String(valB), undefined, { numeric: true })
      return sortDirection === 'asc' ? result : -result
    })
  }, [data, sortKey, sortDirection])

  // Paginación
  const totalPages = Math.ceil(sortedData.length / pageSize) || 1
  const paginatedData = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedData.slice(start, start + pageSize)
  }, [sortedData, currentPage, pageSize])

  const handleSelectAll = () => {
    if (selectedKeys.size === paginatedData.length) {
      setSelectedKeys(new Set())
    } else {
      setSelectedKeys(new Set(paginatedData.map(keyExtractor)))
    }
  }

  const toggleSelect = (key: string) => {
    const next = new Set(selectedKeys)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    setSelectedKeys(next)
  }

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else {
        setSortKey(null)
      }
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  return (
    <div className={cn('flex flex-col gap-3 w-full', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {selectable && (
              <TableHead className="w-12 text-center">
                <input
                  type="checkbox"
                  checked={paginatedData.length > 0 && selectedKeys.size === paginatedData.length}
                  onChange={handleSelectAll}
                  aria-label="Seleccionar todas las filas"
                  className="size-4 rounded-md border-border text-primary focus:ring-primary cursor-pointer accent-[#0369A1]"
                />
              </TableHead>
            )}
            {columns.map((col) => (
              <TableHead
                key={col.key}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
                className={cn(
                  col.sortable && 'cursor-pointer select-none hover:text-foreground',
                  col.align === 'center' && 'text-center',
                  col.align === 'right' && 'text-right'
                )}
              >
                <div className={cn('flex items-center gap-1.5', col.align === 'right' && 'justify-end')}>
                  <span>{col.header}</span>
                  {col.sortable && sortKey === col.key && (
                    <span className="text-primary font-bold">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </TableHead>
            ))}
            {onActionClick && <TableHead className="w-16 text-center">Acciones</TableHead>}
          </TableRow>
        </TableHeader>

        <TableBody>
          {paginatedData.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length + (selectable ? 1 : 0) + (onActionClick ? 1 : 0)}
                className="py-8 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            paginatedData.map((row) => {
              const key = keyExtractor(row)
              const isSelected = selectedKeys.has(key)

              return (
                <TableRow key={key} data-state={isSelected ? 'selected' : undefined}>
                  {selectable && (
                    <TableCell className="text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(key)}
                        aria-label={`Seleccionar fila ${key}`}
                        className="size-4 rounded-md border-border text-primary focus:ring-primary cursor-pointer accent-[#0369A1]"
                      />
                    </TableCell>
                  )}

                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        col.align === 'center' && 'text-center',
                        col.align === 'right' && 'text-right'
                      )}
                    >
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '—')}
                    </TableCell>
                  ))}

                  {onActionClick && (
                    <TableCell className="text-center">
                      <button
                        type="button"
                        onClick={() => onActionClick(row)}
                        className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Acciones de fila"
                      >
                        <svg className="size-4" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="2" />
                          <circle cx="19" cy="12" r="2" />
                          <circle cx="5" cy="12" r="2" />
                        </svg>
                      </button>
                    </TableCell>
                  )}
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>

      {/* Barra de Paginación Accesible */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 text-xs text-muted-foreground">
          <span>
            Página <strong className="text-foreground">{currentPage}</strong> de{' '}
            <strong className="text-foreground">{totalPages}</strong> ({sortedData.length} registros)
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-xl border border-border bg-card text-foreground font-semibold hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-xl border border-border bg-card text-foreground font-semibold hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
