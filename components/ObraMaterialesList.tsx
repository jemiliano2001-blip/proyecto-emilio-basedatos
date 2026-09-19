'use client'

import React, { useState, useMemo, useTransition } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { EditTopeInline } from '@/components/EditTopeInline'
import { MaterialPreviewModal } from '@/components/MaterialPreviewModal'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  IconPaquete,
  IconSearch,
  IconChevron,
  IconBasura,
  IconAlerta,
} from '@/components/icons'
import {
  eliminarMaterialObraAction,
  eliminarTodosMaterialesObraAction,
} from '@/lib/actions/topes'
import type { CatalogoMaterial, SaldoMaterialObra } from '@/lib/types'

interface TopeRow {
  id: string
  material_id: string
  cantidad_contratada: number
}

interface ObraMaterialesListProps {
  obraId: string
  saldos: SaldoMaterialObra[]
  topes: TopeRow[]
  puedeTopes: boolean
  verPrecios: boolean
  puedeEditarCatalogo?: boolean
}

export function ObraMaterialesList({
  obraId,
  saldos,
  topes,
  puedeTopes,
  verPrecios,
  puedeEditarCatalogo = false,
}: ObraMaterialesListProps) {
  const [filtroTexto, setFiltroTexto] = useState('')
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>('todas')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [materialSeleccionado, setMaterialSeleccionado] = useState<CatalogoMaterial | null>(null)
  const [modalAbierto, setModalAbierto] = useState(false)

  // Modales de confirmación de borrado
  const [materialAEliminar, setMaterialAEliminar] = useState<SaldoMaterialObra | null>(null)
  const [modalBorrarTodo, setModalBorrarTodo] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const topePorMaterial = useMemo(
    () => new Map(topes.map((t) => [t.material_id, t])),
    [topes]
  )

  // Categorías presentes en los saldos de esta obra
  const categoriasPresentes = useMemo(() => {
    const cats = new Set<string>()
    for (const s of saldos) {
      if (s.categoria?.trim()) {
        cats.add(s.categoria.trim())
      }
    }
    return Array.from(cats).sort()
  }, [saldos])

  const countSinCategoria = useMemo(
    () => saldos.filter((s) => !s.categoria?.trim()).length,
    [saldos]
  )

  // Filtrado reactivo en cliente (por categoría y texto de búsqueda)
  const saldosFiltrados = useMemo(() => {
    let result = saldos

    if (categoriaSeleccionada === 'sin_categoria') {
      result = result.filter((s) => !s.categoria?.trim())
    } else if (categoriaSeleccionada !== 'todas') {
      result = result.filter((s) => s.categoria?.trim() === categoriaSeleccionada)
    }

    const q = filtroTexto.toLowerCase().trim()
    if (q) {
      result = result.filter(
        (s) =>
          (s.nombre_base || '').toLowerCase().includes(q) ||
          (s.variante ? s.variante.toLowerCase().includes(q) : false) ||
          (s.categoria ? s.categoria.toLowerCase().includes(q) : false) ||
          (s.subcategoria ? s.subcategoria.toLowerCase().includes(q) : false)
      )
    }

    return result
  }, [saldos, categoriaSeleccionada, filtroTexto])

  // Agrupación por categoría / rubro de los resultados filtrados
  const rubrosMap = useMemo(() => {
    const map = new Map<string, SaldoMaterialObra[]>()
    for (const s of saldosFiltrados) {
      const rubro = s.categoria?.trim() || 'Sin categoría'
      const arr = map.get(rubro) ?? []
      arr.push(s)
      map.set(rubro, arr)
    }
    return map
  }, [saldosFiltrados])

  function toggleExpand(materialId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(materialId)) {
        next.delete(materialId)
      } else {
        next.add(materialId)
      }
      return next
    })
  }

  function handleAbrirFicha(s: SaldoMaterialObra) {
    const mat: CatalogoMaterial = {
      id: s.material_id,
      nombre_base: s.nombre_base,
      variante: s.variante ?? null,
      unidad_medida: s.unidad_medida,
      categoria: s.categoria ?? null,
      subcategoria: s.subcategoria ?? null,
      especificacion: null,
      foto_url: s.foto_url ?? null,
      activo: true,
    }
    setMaterialSeleccionado(mat)
    setModalAbierto(true)
  }

  function handleConfirmarEliminarIndividual() {
    if (!materialAEliminar) return
    setDeleteError(null)

    startTransition(async () => {
      const res = await eliminarMaterialObraAction(obraId, materialAEliminar.material_id)
      if (res.error) {
        setDeleteError(res.error)
      } else {
        setMaterialAEliminar(null)
        router.refresh()
      }
    })
  }

  function handleConfirmarEliminarTodos() {
    setDeleteError(null)

    startTransition(async () => {
      const res = await eliminarTodosMaterialesObraAction(obraId)
      if (res.error) {
        setDeleteError(res.error)
      } else {
        setModalBorrarTodo(false)
        router.refresh()
      }
    })
  }

  if (saldos.length === 0) {
    return (
      <EmptyState
        icon={IconPaquete}
        title="Sin materiales asignados"
        description="Todavía no hay materiales asignados en el presupuesto de este proyecto."
        action={
          puedeTopes
            ? {
                label: 'Asignar materiales',
                href: `/obras/${obraId}/asignar-materiales`,
              }
            : undefined
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Barra de Filtros por Categoría (Segmentos Canónicos) y Acción Global de Borrado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/70">
        <div className="overflow-x-auto rounded-lg bg-muted p-0.5 max-w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => setCategoriaSeleccionada('todas')}
              className={cn(
                'inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 text-xs sm:text-sm font-medium transition-all select-none',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                categoriaSeleccionada === 'todas'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card/40'
              )}
            >
              Todas
              <span
                className={cn(
                  'rounded-full px-1.5 text-[11px] tabular-nums font-medium',
                  categoriaSeleccionada === 'todas'
                    ? 'bg-primary-soft text-primary-soft-foreground font-semibold'
                    : 'bg-border/70 text-muted-foreground'
                )}
              >
                {saldos.length}
              </span>
            </button>

            {categoriasPresentes.map((cat) => {
              const count = saldos.filter((s) => s.categoria?.trim() === cat).length
              const active = categoriaSeleccionada === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoriaSeleccionada(cat)}
                  className={cn(
                    'inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 text-xs sm:text-sm font-medium transition-all select-none',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active
                      ? 'bg-card text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-card/40'
                  )}
                >
                  {cat}
                  <span
                    className={cn(
                      'rounded-full px-1.5 text-[11px] tabular-nums font-medium',
                      active
                        ? 'bg-primary-soft text-primary-soft-foreground font-semibold'
                        : 'bg-border/70 text-muted-foreground'
                    )}
                  >
                    {count}
                  </span>
                </button>
              )
            })}

            {countSinCategoria > 0 && (
              <button
                type="button"
                onClick={() => setCategoriaSeleccionada('sin_categoria')}
                className={cn(
                  'inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 text-xs sm:text-sm font-medium transition-all select-none',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  categoriaSeleccionada === 'sin_categoria'
                    ? 'bg-card text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-card/40'
                )}
              >
                Sin categoría
                <span
                  className={cn(
                    'rounded-full px-1.5 text-[11px] tabular-nums font-medium',
                    categoriaSeleccionada === 'sin_categoria'
                      ? 'bg-primary-soft text-primary-soft-foreground font-semibold'
                      : 'bg-border/70 text-muted-foreground'
                  )}
                >
                  {countSinCategoria}
                </span>
              </button>
            )}
          </div>
        </div>

        {puedeTopes && saldos.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setDeleteError(null)
              setModalBorrarTodo(true)
            }}
            className="min-h-[36px] text-xs text-danger hover:text-danger-soft-foreground hover:bg-danger-soft px-3 py-1.5 rounded-lg border border-danger/20 transition-colors inline-flex items-center gap-1.5 font-medium shrink-0 self-start sm:self-auto active:scale-[0.985]"
            title="Eliminar todas las partidas contratadas en este proyecto"
          >
            <IconBasura className="w-3.5 h-3.5" />
            <span>Borrar todo</span>
          </button>
        )}
      </div>

      {/* Buscador reactivo de materiales en el proyecto */}
      {saldos.length > 3 && (
        <div className="relative">
          <IconSearch className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            placeholder="Buscar material por nombre, variante o categoría…"
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            className="input-base pl-9 text-xs sm:text-sm py-2"
          />
        </div>
      )}

      {saldosFiltrados.length === 0 && (
        <div className="card text-center py-8 text-muted-foreground text-sm">
          No se encontraron materiales que coincidan con &quot;{filtroTexto}&quot;.
        </div>
      )}

      {/* Listado agrupado en list-stack limpio */}
      <div className="space-y-6">
        {[...rubrosMap.entries()].map(([rubro, items]) => (
          <div key={rubro} className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                {rubro}
              </h3>
              <span className="text-xs text-muted-foreground tabular-nums">
                {items.length} {items.length === 1 ? 'partida' : 'partidas'}
              </span>
            </div>

            <div className="list-stack">
              {items.map((s) => {
                const tope = topePorMaterial.get(s.material_id)
                const asignado = Number(s.cantidad_asignada ?? s.cantidad_contratada ?? 0)
                const enProceso = Number(s.cantidad_en_proceso ?? s.cantidad_comprometida ?? 0)
                const comprado = Number(s.cantidad_comprada ?? 0)
                const entregado = Number(s.cantidad_entregada ?? s.cantidad_usada ?? 0)
                const disponible = Number(s.cantidad_disponible ?? 0)
                const sinSaldo = disponible <= 0
                const isExpanded = expandedIds.has(s.material_id)

                return (
                  <div
                    key={s.material_id}
                    className={cn(
                      'p-3.5 transition-colors hover:bg-muted/30',
                      sinSaldo && 'border-l-2 border-l-warning'
                    )}
                  >
                    {/* Fila compacta (Header de acordeón) */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Botón de ficha / foto */}
                        <button
                          type="button"
                          onClick={() => handleAbrirFicha(s)}
                          className="w-10 h-10 rounded-lg bg-muted border border-border/80 shrink-0 flex items-center justify-center overflow-hidden hover:opacity-90 hover:ring-2 hover:ring-ring/40 transition-all cursor-pointer"
                          title="Ver ficha técnica"
                        >
                          {s.foto_url ? (
                            <Image
                              src={s.foto_url}
                              alt={s.nombre_base}
                              width={40}
                              height={40}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-muted-foreground text-[10px] font-semibold">
                              Doc
                            </span>
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-sm text-foreground truncate">
                              {s.nombre_base}
                            </span>
                            {s.variante && (
                              <span className="text-xs text-muted-foreground font-normal truncate">
                                · {s.variante}
                              </span>
                            )}
                            <span className="text-[11px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {s.unidad_medida}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Estatus rápido y botón desplegable */}
                      <div className="flex items-center gap-2.5 shrink-0">
                        {sinSaldo ? (
                          <Badge variant="warning" dot>Sin saldo</Badge>
                        ) : (
                          <Badge variant="success" dot>
                            Disp: {disponible}
                          </Badge>
                        )}

                        <button
                          type="button"
                          onClick={() => toggleExpand(s.material_id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          title={isExpanded ? 'Colapsar detalle' : 'Ver desglose numérico'}
                          aria-label={isExpanded ? 'Colapsar' : 'Expandir'}
                        >
                          <IconChevron
                            className={cn(
                              'w-4 h-4 transition-transform duration-200',
                              isExpanded && 'rotate-90 text-foreground'
                            )}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Detalle expandible del Acordeón (Franja métrica limpia, sin cajas anidadas) */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border/60 animate-enter space-y-3">
                        {/* Franja métrica horizontal limpia y tabular */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 rounded-lg bg-muted/40 p-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Asignado</p>
                            <p className="tabular-nums font-semibold text-foreground text-sm mt-0.5">
                              {asignado}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">En proceso</p>
                            <p className="tabular-nums font-semibold text-foreground text-sm mt-0.5">
                              {enProceso}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Comprado</p>
                            <p className="tabular-nums font-semibold text-foreground text-sm mt-0.5">
                              {comprado}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Entregado</p>
                            <p className="tabular-nums font-semibold text-foreground text-sm mt-0.5">
                              {entregado}
                            </p>
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Disponible</p>
                            <p
                              className={cn(
                                'tabular-nums font-bold text-sm mt-0.5',
                                sinSaldo ? 'text-danger' : 'text-primary'
                              )}
                            >
                              {disponible}
                            </p>
                          </div>
                        </div>

                        {/* Acciones de gestión para usuarios con permisos */}
                        {puedeTopes && tope && (
                          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-border/60">
                            <div className="flex-1">
                              <EditTopeInline
                                topeId={tope.id}
                                obraId={obraId}
                                materialId={s.material_id}
                                cantidadActual={Number(tope.cantidad_contratada)}
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setDeleteError(null)
                                setMaterialAEliminar(s)
                              }}
                              className="min-h-[36px] text-xs text-danger hover:text-danger-soft-foreground hover:bg-danger-soft px-3 py-1.5 rounded-lg border border-danger/20 transition-colors inline-flex items-center gap-1.5 self-end sm:self-center font-medium active:scale-[0.985]"
                              title="Eliminar este material del proyecto"
                            >
                              <IconBasura className="w-3.5 h-3.5" />
                              <span>Eliminar de la obra</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Modal de confirmación para eliminar material individual */}
      <Dialog
        open={Boolean(materialAEliminar)}
        onOpenChange={(open) => {
          if (!open) {
            setMaterialAEliminar(null)
            setDeleteError(null)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-danger-soft text-danger flex items-center justify-center mb-2">
              <IconBasura className="w-5 h-5" />
            </div>
            <DialogTitle>Eliminar material de la obra</DialogTitle>
            <DialogDescription>
              ¿Deseas eliminar{' '}
              <strong className="text-foreground">
                {materialAEliminar?.nombre_base}
                {materialAEliminar?.variante ? ` (${materialAEliminar.variante})` : ''}
              </strong>{' '}
              del presupuesto contratado de este proyecto?
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <div className="p-3 text-xs bg-danger-soft text-danger-soft-foreground border border-danger/30 rounded-lg flex items-start gap-2">
              <IconAlerta className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{deleteError}</span>
            </div>
          )}

          <DialogFooter>
            <DialogClose
              disabled={isPending}
              className="btn-secondary btn-sm"
            >
              Cancelar
            </DialogClose>
            <button
              type="button"
              disabled={isPending}
              onClick={handleConfirmarEliminarIndividual}
              className="btn-danger btn-sm font-medium"
            >
              {isPending ? 'Eliminando…' : 'Eliminar material'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación para BORRAR TODOS los materiales */}
      <Dialog
        open={modalBorrarTodo}
        onOpenChange={(open) => {
          if (!open) {
            setModalBorrarTodo(false)
            setDeleteError(null)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-danger-soft text-danger flex items-center justify-center mb-2">
              <IconAlerta className="w-5 h-5" />
            </div>
            <DialogTitle>¿Borrar todos los materiales?</DialogTitle>
            <DialogDescription>
              Esta acción eliminará todas las partidas contratadas ({saldos.length} materiales) de este proyecto.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 text-xs bg-warning-soft text-warning-soft-foreground border border-warning/30 rounded-lg">
            <strong>Atención:</strong> Se vaciará el catálogo de materiales asignados a esta obra. Las órdenes de compra ya emitidas y recepciones previas mantendrán su historial de auditoría.
          </div>

          {deleteError && (
            <div className="p-3 text-xs bg-danger-soft text-danger-soft-foreground border border-danger/30 rounded-lg flex items-start gap-2">
              <IconAlerta className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{deleteError}</span>
            </div>
          )}

          <DialogFooter>
            <DialogClose
              disabled={isPending}
              className="btn-secondary btn-sm"
            >
              Cancelar
            </DialogClose>
            <button
              type="button"
              disabled={isPending}
              onClick={handleConfirmarEliminarTodos}
              className="btn-danger btn-sm font-medium"
            >
              {isPending ? 'Eliminando todo…' : 'Sí, vaciar materiales'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de ficha técnica interactiva */}
      <MaterialPreviewModal
        material={materialSeleccionado}
        open={modalAbierto}
        onClose={() => setModalAbierto(false)}
        puedeEditar={puedeEditarCatalogo}
        verPrecios={verPrecios}
      />
    </div>
  )
}
