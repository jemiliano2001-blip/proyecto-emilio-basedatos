'use client'

import React, { useState, useMemo, useTransition } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
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
          s.nombre_base.toLowerCase().includes(q) ||
          (s.variante && s.variante.toLowerCase().includes(q)) ||
          (s.categoria && s.categoria.toLowerCase().includes(q)) ||
          (s.subcategoria && s.subcategoria.toLowerCase().includes(q))
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
      {/* Barra de Filtros por Categoría (Pills) y Acción Global de Borrado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-gray-100">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none">
          <button
            type="button"
            onClick={() => setCategoriaSeleccionada('todas')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              categoriaSeleccionada === 'todas'
                ? 'bg-navy text-white shadow-sm'
                : 'bg-slate-100 text-gray-700 hover:bg-slate-200'
            }`}
          >
            Todas <span className="opacity-75 tabular-nums">({saldos.length})</span>
          </button>

          {categoriasPresentes.map((cat) => {
            const count = saldos.filter((s) => s.categoria?.trim() === cat).length
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoriaSeleccionada(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  categoriaSeleccionada === cat
                    ? 'bg-navy text-white shadow-sm'
                    : 'bg-slate-100 text-gray-700 hover:bg-slate-200'
                }`}
              >
                {cat} <span className="opacity-75 tabular-nums">({count})</span>
              </button>
            )
          })}

          {countSinCategoria > 0 && (
            <button
              type="button"
              onClick={() => setCategoriaSeleccionada('sin_categoria')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                categoriaSeleccionada === 'sin_categoria'
                  ? 'bg-navy text-white shadow-sm'
                  : 'bg-slate-100 text-gray-700 hover:bg-slate-200'
              }`}
            >
              Sin categoría <span className="opacity-75 tabular-nums">({countSinCategoria})</span>
            </button>
          )}
        </div>

        {puedeTopes && saldos.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setDeleteError(null)
              setModalBorrarTodo(true)
            }}
            className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 px-2.5 py-1.5 rounded-md border border-red-200 transition-colors inline-flex items-center gap-1.5 font-medium shrink-0 self-start sm:self-auto"
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
          <IconSearch className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
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
        <div className="card text-center py-6 text-gray-500 text-sm">
          No se encontraron materiales que coincidan con &quot;{filtroTexto}&quot;.
        </div>
      )}

      {/* Listado agrupado en Acordeón Compacto */}
      <div className="space-y-6">
        {[...rubrosMap.entries()].map(([rubro, items]) => (
          <div key={rubro} className="space-y-2">
            <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
              <h3 className="text-xs font-bold text-ink uppercase tracking-wider">
                {rubro}
              </h3>
              <span className="text-xs text-gray-400 tabular-nums">
                {items.length} {items.length === 1 ? 'partida' : 'partidas'}
              </span>
            </div>

            <div className="space-y-1.5">
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
                    className={`card p-3 transition-colors ${
                      sinSaldo ? 'border-red-200 bg-red-50/15' : 'hover:border-gray-300'
                    }`}
                  >
                    {/* Fila compacta (Header de acordeón) */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {/* Botón de ficha / foto */}
                        <button
                          type="button"
                          onClick={() => handleAbrirFicha(s)}
                          className="w-9 h-9 rounded-lg bg-gray-100 border border-gray-200 shrink-0 flex items-center justify-center overflow-hidden hover:opacity-90 hover:ring-2 hover:ring-accent transition-all cursor-pointer"
                          title="Ver ficha técnica"
                        >
                          {s.foto_url ? (
                            <Image
                              src={s.foto_url}
                              alt={s.nombre_base}
                              width={36}
                              height={36}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-gray-400 text-[10px] font-semibold">
                              Doc
                            </span>
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-sm text-ink truncate">
                              {s.nombre_base}
                            </span>
                            {s.variante && (
                              <span className="text-xs text-gray-500 font-normal truncate">
                                · {s.variante}
                              </span>
                            )}
                            <span className="text-[11px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                              {s.unidad_medida}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Estatus rápido y botón desplegable */}
                      <div className="flex items-center gap-2 shrink-0">
                        {sinSaldo ? (
                          <Badge variant="red">Sin saldo</Badge>
                        ) : (
                          <span className="text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md tabular-nums">
                            Disp: {disponible}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => toggleExpand(s.material_id)}
                          className="p-1 rounded-md text-gray-400 hover:text-navy hover:bg-gray-100 transition-colors focus:outline-none"
                          title={isExpanded ? 'Colapsar detalle' : 'Ver detalle numérico y acciones'}
                          aria-label={isExpanded ? 'Colapsar' : 'Expandir'}
                        >
                          <IconChevron
                            className={`w-4 h-4 transition-transform duration-200 ${
                              isExpanded ? 'rotate-90 text-navy' : ''
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Detalle expandible del Acordeón */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-gray-100 animate-fade-in space-y-3">
                        {/* Desglose de saldos numérico */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                          <div className="bg-slate-50 p-2 rounded border border-slate-100">
                            <p className="text-gray-500 font-medium">Asignado</p>
                            <p className="tabular-nums font-semibold text-gray-900 text-sm mt-0.5">
                              {asignado}
                            </p>
                          </div>
                          <div className="bg-slate-50 p-2 rounded border border-slate-100">
                            <p className="text-gray-500 font-medium">En proceso</p>
                            <p className="tabular-nums font-semibold text-gray-900 text-sm mt-0.5">
                              {enProceso}
                            </p>
                          </div>
                          <div className="bg-slate-50 p-2 rounded border border-slate-100">
                            <p className="text-gray-500 font-medium">Comprado</p>
                            <p className="tabular-nums font-semibold text-gray-900 text-sm mt-0.5">
                              {comprado}
                            </p>
                          </div>
                          <div className="bg-slate-50 p-2 rounded border border-slate-100">
                            <p className="text-gray-500 font-medium">Entregado</p>
                            <p className="tabular-nums font-semibold text-gray-900 text-sm mt-0.5">
                              {entregado}
                            </p>
                          </div>
                          <div
                            className={`p-2 rounded col-span-2 sm:col-span-1 border ${
                              sinSaldo
                                ? 'bg-red-50 border-red-200 text-red-700'
                                : 'bg-teal-50 border-teal-200 text-teal-800'
                            }`}
                          >
                            <p className="font-semibold">Disponible</p>
                            <p className="tabular-nums font-bold text-sm mt-0.5">
                              {disponible}
                            </p>
                          </div>
                        </div>

                        {/* Acciones de gestión para usuarios con permisos */}
                        {puedeTopes && tope && (
                          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-gray-100">
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
                              className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded border border-red-200 transition-colors inline-flex items-center gap-1 self-end sm:self-center font-medium"
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
            <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-2">
              <IconBasura className="w-5 h-5" />
            </div>
            <DialogTitle>Eliminar material de la obra</DialogTitle>
            <DialogDescription>
              ¿Deseas eliminar{' '}
              <strong className="text-gray-900">
                {materialAEliminar?.nombre_base}
                {materialAEliminar?.variante ? ` (${materialAEliminar.variante})` : ''}
              </strong>{' '}
              del presupuesto contratado de este proyecto?
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-start gap-2">
              <IconAlerta className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{deleteError}</span>
            </div>
          )}

          <DialogFooter>
            <DialogClose
              disabled={isPending}
              className="btn-secondary px-4 py-2 text-sm"
            >
              Cancelar
            </DialogClose>
            <button
              type="button"
              disabled={isPending}
              onClick={handleConfirmarEliminarIndividual}
              className="btn-danger px-4 py-2 text-sm font-medium"
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
            <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-2">
              <IconAlerta className="w-5 h-5" />
            </div>
            <DialogTitle>¿Borrar todos los materiales?</DialogTitle>
            <DialogDescription>
              Esta acción eliminará todas las partidas contratadas ({saldos.length} materiales) de este proyecto.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 text-xs bg-amber-50 text-amber-900 border border-amber-200 rounded-lg">
            <strong>Atención:</strong> Se vaciará el catálogo de materiales asignados a esta obra. Las órdenes de compra ya emitidas y recepciones previas mantendrán su historial de auditoría.
          </div>

          {deleteError && (
            <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-start gap-2">
              <IconAlerta className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{deleteError}</span>
            </div>
          )}

          <DialogFooter>
            <DialogClose
              disabled={isPending}
              className="btn-secondary px-4 py-2 text-sm"
            >
              Cancelar
            </DialogClose>
            <button
              type="button"
              disabled={isPending}
              onClick={handleConfirmarEliminarTodos}
              className="btn-danger px-4 py-2 text-sm font-medium"
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
