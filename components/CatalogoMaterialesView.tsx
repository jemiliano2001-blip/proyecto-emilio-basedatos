'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { IconPlus, IconEditar, IconBasura, IconPaquete } from '@/components/icons'
import { EmptyState } from '@/components/EmptyState'
import { MaterialPreviewModal } from '@/components/MaterialPreviewModal'
import { formatMoneyMx } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useModalFocus } from '@/lib/hooks/useModalFocus'
import type { CatalogoMaterial, MaterialCategoria } from '@/lib/types'
import {
  crearCategoriaAction,
  actualizarCategoriaAction,
  eliminarCategoriaAction,
  crearSubcategoriaAction,
  actualizarSubcategoriaAction,
  eliminarSubcategoriaAction,
} from '@/lib/actions/categorias'

function MaterialCard({
  m,
  puedeEditar,
  verPrecios,
  onSelect,
  selected,
  onToggleSelected,
  compact,
  showImage,
}: {
  m: CatalogoMaterial
  puedeEditar: boolean
  verPrecios: boolean
  onSelect: (m: CatalogoMaterial) => void
  selected: boolean
  onToggleSelected: (event: React.MouseEvent<HTMLInputElement>) => void
  compact: boolean
  showImage: boolean
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(m)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(m)
        }
      }}
      className={cn(
        'card-interactive relative text-left group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        compact ? 'p-2.5' : 'p-3',
        selected && 'ring-2 ring-primary border-primary/50'
      )}
    >
      {/* Checkbox discreto y elegante */}
      <label
        className={cn(
          'absolute left-2.5 top-2.5 z-10 flex min-h-[32px] min-w-[32px] cursor-pointer items-center justify-center rounded-lg transition-all',
          'bg-card/90 backdrop-blur-xs border border-border/80 shadow-xs hover:border-primary',
          selected ? 'opacity-100 bg-primary border-primary text-primary-foreground' : 'opacity-80 sm:opacity-0 group-hover:opacity-100 focus-within:opacity-100'
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <span className="sr-only">Seleccionar {m.nombre_base}</span>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => undefined}
          onClick={onToggleSelected}
          className="h-4 w-4 rounded accent-primary cursor-pointer"
        />
      </label>

      {/* Botón editar discreto en hover */}
      {puedeEditar && (
        <Link
          href={`/materiales/${m.id}`}
          onClick={(e) => e.stopPropagation()}
          className="absolute top-2.5 right-2.5 z-10 flex min-h-[32px] min-w-[32px] items-center justify-center rounded-lg bg-card/90 backdrop-blur-xs shadow-xs border border-border/80 text-muted-foreground hover:text-foreground hover:bg-card transition-all opacity-80 sm:opacity-0 group-hover:opacity-100 focus:opacity-100"
          title="Editar material"
          aria-label={`Editar ${m.nombre_base}`}
        >
          <IconEditar className="w-3.5 h-3.5" />
        </Link>
      )}

      {showImage && (
        <div className="aspect-square bg-muted/40 rounded-lg mb-2.5 flex items-center justify-center overflow-hidden border border-border/60">
          {m.foto_url ? (
            <Image
              src={m.foto_url}
              alt={m.nombre_base}
              width={200}
              height={200}
              unoptimized
              className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-200"
            />
          ) : (
            <span className="text-muted-foreground text-xs font-medium">Sin foto</span>
          )}
        </div>
      )}

      <p className="font-semibold text-sm text-foreground line-clamp-2 group-hover:text-primary transition-colors">
        {m.nombre_base}
      </p>
      {!m.activo && (
        <p className="mt-1 text-[11px] font-semibold text-warning-soft-foreground">
          Inactivo: no disponible en requisiciones.
        </p>
      )}
      {m.variante && <p className="text-xs text-muted-foreground truncate mt-0.5">{m.variante}</p>}
      {m.subcategoria && (
        <p className="text-[11px] text-muted-foreground/80 mt-0.5">{m.subcategoria}</p>
      )}
      <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-border/60">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          {m.unidad_medida}
        </span>
        {verPrecios && m.precio_base !== undefined && m.precio_base > 0 && (
          <span className="text-xs font-semibold tabular-nums text-primary">
            {formatMoneyMx(m.precio_base)}
          </span>
        )}
      </div>
    </div>
  )
}

export function CatalogoMaterialesView({
  materiales,
  categorias,
  puedeEditar,
  verPrecios,
  hasLoadError = false,
  initialCategoria,
}: {
  materiales: CatalogoMaterial[]
  categorias: MaterialCategoria[]
  puedeEditar: boolean
  verPrecios: boolean
  hasLoadError?: boolean
  initialCategoria?: string
}) {
  // Selector de categoría: si viene por query inicial o la primera categoría disponible
  const [selectedCat, setSelectedCat] = useState<string>(
    initialCategoria ?? categorias[0]?.nombre ?? 'todas'
  )
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [density, setDensity] = useState<'comfortable' | 'compact'>(() => 'comfortable')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [showImages, setShowImages] = useState(true)
  const [savedViews, setSavedViews] = useState<string[]>([])
  const [previewMaterial, setPreviewMaterial] = useState<CatalogoMaterial | null>(null)
  const [isPending, startTransition] = useTransition()
  const [modalType, setModalType] = useState<
    | null
    | 'nueva_cat'
    | 'editar_cat'
    | 'eliminar_cat'
    | 'nueva_sub'
    | 'editar_sub'
    | 'eliminar_sub'
  >(null)
  const lastSelectedIndex = useRef<number | null>(null)

  useEffect(() => {
    const storedDensity = window.localStorage.getItem('obra_track_catalog_density')
    if (storedDensity === 'compact') setDensity('compact')
    if (window.localStorage.getItem('obra_track_catalog_images') === 'hidden') setShowImages(false)
    try {
      const storedViews = JSON.parse(window.localStorage.getItem('obra_track_catalog_views') ?? '[]')
      if (Array.isArray(storedViews)) setSavedViews(storedViews.filter((value): value is string => typeof value === 'string'))
    } catch {
      window.localStorage.removeItem('obra_track_catalog_views')
    }
  }, [])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || previewMaterial) return
      if (modalType) {
        setModalType(null)
        setTargetCat(null)
        setTargetSub(null)
        setInputNombre('')
        setFormError(null)
      } else setSelectedIds(new Set())
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [modalType, previewMaterial])

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (selectedCat === 'todas') params.delete('categoria')
    else params.set('categoria', selectedCat)
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [pathname, router, searchParams, selectedCat])

  const selectedMaterials = useMemo(
    () => materiales.filter((material) => selectedIds.has(material.id)),
    [materiales, selectedIds]
  )

  const selectableMaterials = useMemo(() => {
    if (selectedCat === 'todas') return materiales
    if (selectedCat === 'sin_categoria') return materiales.filter((material) => !material.categoria)
    return materiales.filter((material) => material.categoria === selectedCat)
  }, [materiales, selectedCat])

  useEffect(() => {
    lastSelectedIndex.current = null
  }, [selectedCat])

  function toggleMaterial(material: CatalogoMaterial, event: React.MouseEvent<HTMLInputElement>) {
    const index = selectableMaterials.findIndex((item) => item.id === material.id)
    if (index < 0) return
    setSelectedIds((current) => {
      const next = new Set(current)
      if (event.shiftKey && lastSelectedIndex.current !== null) {
        const start = Math.min(lastSelectedIndex.current, index)
        const end = Math.max(lastSelectedIndex.current, index)
        for (let position = start; position <= end; position += 1) next.add(selectableMaterials[position].id)
      } else if (next.has(material.id)) next.delete(material.id)
      else next.add(material.id)
      return next
    })
    lastSelectedIndex.current = index
  }

  function toggleSavedView() {
    const next = savedViews.includes(selectedCat)
      ? savedViews.filter((view) => view !== selectedCat)
      : [...savedViews, selectedCat]
    setSavedViews(next)
    window.localStorage.setItem('obra_track_catalog_views', JSON.stringify(next))
  }

  async function exportSelected() {
    const { descargarMaterialesExcel, descargarMaterialesCsv } = await import('@/lib/export-selected-materials')
    try {
      await descargarMaterialesExcel(selectedMaterials, verPrecios)
    } catch {
      descargarMaterialesCsv(selectedMaterials, verPrecios)
    }
  }

  const categoryDialogRef = useRef<HTMLDivElement>(null)
  useModalFocus(Boolean(modalType), categoryDialogRef)

  // Datos para modales
  const [targetCat, setTargetCat] = useState<MaterialCategoria | null>(null)
  const [targetSub, setTargetSub] = useState<{ id: string; nombre: string; categoriaId: string } | null>(null)
  const [inputNombre, setInputNombre] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  // Categorías activas
  const categoriaActual = categorias.find((c) => c.nombre === selectedCat)

  // Materiales sin categoría asignada
  const sinCategoria = materiales.filter((m) => !m.categoria)

  function abrirNuevaCategoria() {
    setInputNombre('')
    setFormError(null)
    setModalType('nueva_cat')
  }

  function abrirEditarCategoria(cat: MaterialCategoria) {
    setTargetCat(cat)
    setInputNombre(cat.nombre)
    setFormError(null)
    setModalType('editar_cat')
  }

  function abrirEliminarCategoria(cat: MaterialCategoria) {
    setTargetCat(cat)
    setFormError(null)
    setModalType('eliminar_cat')
  }

  function abrirNuevaSubcategoria(cat: MaterialCategoria) {
    setTargetCat(cat)
    setInputNombre('')
    setFormError(null)
    setModalType('nueva_sub')
  }

  function abrirEditarSubcategoria(catId: string, sub: { id: string; nombre: string }) {
    setTargetSub({ id: sub.id, nombre: sub.nombre, categoriaId: catId })
    setInputNombre(sub.nombre)
    setFormError(null)
    setModalType('editar_sub')
  }

  function abrirEliminarSubcategoria(catId: string, sub: { id: string; nombre: string }) {
    setTargetSub({ id: sub.id, nombre: sub.nombre, categoriaId: catId })
    setFormError(null)
    setModalType('eliminar_sub')
  }

  function cerrarModal() {
    setModalType(null)
    setTargetCat(null)
    setTargetSub(null)
    setInputNombre('')
    setFormError(null)
  }

  function handleGuardarModal(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    startTransition(async () => {
      const fd = new FormData()
      fd.append('nombre', inputNombre)

      if (modalType === 'nueva_cat') {
        const res = await crearCategoriaAction({ error: null }, fd)
        if (res.error) {
          setFormError(res.error)
        } else {
          setSelectedCat(inputNombre.trim())
          cerrarModal()
        }
      } else if (modalType === 'editar_cat' && targetCat) {
        const res = await actualizarCategoriaAction(targetCat.id, { error: null }, fd)
        if (res.error) {
          setFormError(res.error)
        } else {
          if (selectedCat === targetCat.nombre) {
            setSelectedCat(inputNombre.trim())
          }
          cerrarModal()
        }
      } else if (modalType === 'eliminar_cat' && targetCat) {
        const res = await eliminarCategoriaAction(targetCat.id)
        if (res.error) {
          setFormError(res.error)
        } else {
          setSelectedCat('todas')
          cerrarModal()
        }
      } else if (modalType === 'nueva_sub' && targetCat) {
        fd.append('categoria_id', targetCat.id)
        const res = await crearSubcategoriaAction({ error: null }, fd)
        if (res.error) {
          setFormError(res.error)
        } else {
          cerrarModal()
        }
      } else if (modalType === 'editar_sub' && targetSub) {
        const res = await actualizarSubcategoriaAction(targetSub.id, { error: null }, fd)
        if (res.error) {
          setFormError(res.error)
        } else {
          cerrarModal()
        }
      } else if (modalType === 'eliminar_sub' && targetSub) {
        const res = await eliminarSubcategoriaAction(targetSub.id)
        if (res.error) {
          setFormError(res.error)
        } else {
          cerrarModal()
        }
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* 1. SELECTOR DE CATEGORÍA SUPERIOR */}
      <div className="card p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Categoría
            </span>
            <p className="text-xs text-muted-foreground">
              Elige una categoría para desplegar sus subcategorías y materiales asociados.
            </p>
          </div>
          {puedeEditar && (
            <button
              type="button"
              onClick={abrirNuevaCategoria}
              className="btn-secondary btn-xs self-start sm:self-auto shrink-0"
            >
              <IconPlus className="w-3.5 h-3.5" />
              <span>Nueva categoría</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2" aria-label="Preferencias del catálogo">
          <button
            type="button"
            className="btn-ghost btn-xs aria-pressed:bg-muted aria-pressed:text-foreground"
            onClick={() => {
              const next = density === 'comfortable' ? 'compact' : 'comfortable'
              setDensity(next)
              window.localStorage.setItem('obra_track_catalog_density', next)
            }}
            aria-pressed={density === 'compact'}
          >
            Densidad: {density === 'compact' ? 'compacta' : 'cómoda'}
          </button>
          <button type="button" className="btn-ghost btn-xs aria-pressed:bg-muted aria-pressed:text-foreground" onClick={toggleSavedView} aria-pressed={savedViews.includes(selectedCat)}>
            {savedViews.includes(selectedCat) ? 'Quitar vista guardada' : 'Guardar esta vista'}
          </button>
          <button
            type="button"
            className="btn-ghost btn-xs aria-pressed:bg-muted aria-pressed:text-foreground"
            onClick={() => {
              const next = !showImages
              setShowImages(next)
              window.localStorage.setItem('obra_track_catalog_images', next ? 'visible' : 'hidden')
            }}
            aria-pressed={showImages}
          >
            {showImages ? 'Ocultar fotos' : 'Mostrar fotos'}
          </button>
          {savedViews.length > 0 && (
            <label className="text-sm font-semibold text-foreground">
              <span className="sr-only">Abrir vista guardada</span>
              <select className="input-base min-w-48 py-2" value="" onChange={(event) => event.target.value && setSelectedCat(event.target.value)}>
                <option value="">Vistas guardadas</option>
                {savedViews.map((view) => <option key={view} value={view}>{view === 'todas' ? 'Todas' : view.replaceAll('_', ' ')}</option>)}
              </select>
            </label>
          )}
        </div>

        {/* Selector de categoría (Control Segmentado Canónico) */}
        <div className="overflow-x-auto rounded-lg bg-muted p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex shrink-0 items-center gap-0.5">
            {categorias.map((cat) => {
              const isSelected = selectedCat === cat.nombre
              const count = materiales.filter((m) => m.categoria === cat.nombre).length
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCat(cat.nombre)}
                  className={cn(
                    'inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 text-xs sm:text-sm font-medium transition-all select-none',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isSelected
                      ? 'bg-card text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-card/40'
                  )}
                >
                  {cat.nombre}
                  <span
                    className={cn(
                      'rounded-full px-1.5 text-[11px] tabular-nums font-medium',
                      isSelected
                        ? 'bg-primary-soft text-primary-soft-foreground font-semibold'
                        : 'bg-border/70 text-muted-foreground'
                    )}
                  >
                    {count}
                  </span>
                </button>
              )
            })}

            {sinCategoria.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedCat('sin_categoria')}
                className={cn(
                  'inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 text-xs sm:text-sm font-medium transition-all select-none',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selectedCat === 'sin_categoria'
                    ? 'bg-card text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-card/40'
                )}
              >
                Sin categoría
                <span
                  className={cn(
                    'rounded-full px-1.5 text-[11px] tabular-nums font-medium',
                    selectedCat === 'sin_categoria'
                      ? 'bg-primary-soft text-primary-soft-foreground font-semibold'
                      : 'bg-border/70 text-muted-foreground'
                  )}
                >
                  {sinCategoria.length}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSelectedCat('todas')}
              className={cn(
                'inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 text-xs sm:text-sm font-medium transition-all select-none',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selectedCat === 'todas'
                  ? 'bg-card text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card/40'
              )}
            >
              Todas
              <span
                className={cn(
                  'rounded-full px-1.5 text-[11px] tabular-nums font-medium',
                  selectedCat === 'todas'
                    ? 'bg-primary-soft text-primary-soft-foreground font-semibold'
                    : 'bg-border/70 text-muted-foreground'
                )}
              >
                {materiales.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. DESPLIEGUE EXCLUSIVO DE LA CATEGORÍA SELECCIONADA */}
      <div className="space-y-8">
        {/* Caso A: Se seleccionó una categoría específica */}
        {categoriaActual && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 bg-muted/50 border border-border rounded-xl">
              <div>
                <h2 className="text-lg font-bold text-foreground">{categoriaActual.nombre}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {(categoriaActual.material_subcategorias?.length ?? 0)} subcategorías configuradas
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Botón Nuevo material prellenando la categoría */}
                <Link
                  href={`/materiales/nuevo?categoria=${encodeURIComponent(categoriaActual.nombre)}`}
                  className="btn-secondary btn-xs"
                >
                  <IconPlus className="w-3.5 h-3.5" />
                  <span>Nuevo material</span>
                </Link>

                {puedeEditar && (
                  <>
                    <button
                      type="button"
                      onClick={() => abrirNuevaSubcategoria(categoriaActual)}
                      className="btn-secondary btn-xs"
                    >
                      <IconPlus className="w-3 h-3" />
                      <span>Subcategoría</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirEditarCategoria(categoriaActual)}
                      className="btn-secondary btn-xs"
                    >
                      <IconEditar className="w-3 h-3" />
                      <span>Renombrar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirEliminarCategoria(categoriaActual)}
                      className="btn-secondary btn-xs text-danger hover:text-danger-soft-foreground"
                    >
                      <IconBasura className="w-3 h-3" />
                      <span>Quitar</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Subcategorías de esta categoría */}
            {(categoriaActual.material_subcategorias ?? []).map((sub) => {
              const items = materiales.filter(
                (m) => m.categoria === categoriaActual.nombre && m.subcategoria === sub.nombre
              )

              return (
                <div key={sub.id} className="card space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
                        {sub.nombre}
                      </h3>
                      <span className="text-xs text-muted-foreground tabular-nums">({items.length})</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Botón Nuevo material prellenando categoría y subcategoría */}
                      <Link
                        href={`/materiales/nuevo?categoria=${encodeURIComponent(
                          categoriaActual.nombre
                        )}&subcategoria=${encodeURIComponent(sub.nombre)}`}
                        className="btn-secondary btn-xs text-primary-soft-foreground"
                      >
                        <IconPlus className="w-3 h-3" />
                        <span>Nuevo material</span>
                      </Link>

                      {puedeEditar && (
                        <>
                          <button
                            type="button"
                            onClick={() => abrirEditarSubcategoria(categoriaActual.id, sub)}
                            className="text-muted-foreground hover:text-foreground p-1"
                            title="Renombrar subcategoría"
                          >
                            <IconEditar className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => abrirEliminarSubcategoria(categoriaActual.id, sub)}
                            className="text-muted-foreground hover:text-danger p-1"
                            title="Eliminar subcategoría"
                          >
                            <IconBasura className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {items.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-1">
                      {items.map((m) => (
                        <MaterialCard
                          key={m.id}
                          m={m}
                          puedeEditar={puedeEditar}
                          verPrecios={verPrecios}
                          onSelect={setPreviewMaterial}
                          selected={selectedIds.has(m.id)}
                          onToggleSelected={(event) => toggleMaterial(m, event)}
                          compact={density === 'compact'}
                          showImage={showImages}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic py-2">
                      No hay materiales registrados en esta subcategoría.
                    </p>
                  )}
                </div>
              )
            })}

            {/* Materiales en esta categoría sin subcategoría asignada */}
            {(() => {
              const subNombres = new Set(
                (categoriaActual.material_subcategorias ?? []).map((s) => s.nombre)
              )
              const itemsSinSub = materiales.filter(
                (m) =>
                  m.categoria === categoriaActual.nombre &&
                  (!m.subcategoria || !subNombres.has(m.subcategoria))
              )

              if (itemsSinSub.length === 0) return null

              return (
                <div className="card space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">
                      Otras / Sin subcategoría
                    </h3>
                    <Link
                      href={`/materiales/nuevo?categoria=${encodeURIComponent(categoriaActual.nombre)}`}
                      className="btn-secondary btn-xs text-primary-soft-foreground"
                    >
                      <IconPlus className="w-3 h-3" />
                      <span>Nuevo material</span>
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-1">
                    {itemsSinSub.map((m) => (
                      <MaterialCard
                        key={m.id}
                        m={m}
                        puedeEditar={puedeEditar}
                        verPrecios={verPrecios}
                        onSelect={setPreviewMaterial}
                        selected={selectedIds.has(m.id)}
                        onToggleSelected={(event) => toggleMaterial(m, event)}
                        compact={density === 'compact'}
                        showImage={showImages}
                      />
                    ))}
                  </div>
                </div>
              )
            })()}
          </section>
        )}

        {/* Caso B: "Sin categoría" seleccionado */}
        {selectedCat === 'sin_categoria' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 border border-border rounded-xl">
              <div>
                <h2 className="text-lg font-bold text-foreground">Sin categoría</h2>
                <p className="text-xs text-muted-foreground">Materiales que aún no tienen un rubro asignado.</p>
              </div>
              <Link
                href="/materiales/nuevo"
                className="btn-secondary btn-xs"
              >
                <IconPlus className="w-3.5 h-3.5" />
                <span>Nuevo material</span>
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {sinCategoria.map((m) => (
                <MaterialCard
                  key={m.id}
                  m={m}
                  puedeEditar={puedeEditar}
                  verPrecios={verPrecios}
                  onSelect={setPreviewMaterial}
                  selected={selectedIds.has(m.id)}
                  onToggleSelected={(event) => toggleMaterial(m, event)}
                  compact={density === 'compact'}
                  showImage={showImages}
                />
              ))}
            </div>
          </section>
        )}

        {/* Caso C: "Todas" seleccionado */}
        {selectedCat === 'todas' && (
          <section className="space-y-8">
            {categorias.map((cat) => {
              const itemsCat = materiales.filter((m) => m.categoria === cat.nombre)
              return (
                <div key={cat.id} className="space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <h2 className="text-base font-bold text-foreground">{cat.nombre}</h2>
                    <Link
                      href={`/materiales/nuevo?categoria=${encodeURIComponent(cat.nombre)}`}
                      className="btn-secondary btn-xs text-primary-soft-foreground"
                    >
                      <IconPlus className="w-3 h-3" />
                      <span>Nuevo material</span>
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {itemsCat.map((m) => (
                      <MaterialCard
                        key={m.id}
                        m={m}
                        puedeEditar={puedeEditar}
                        verPrecios={verPrecios}
                        onSelect={setPreviewMaterial}
                        selected={selectedIds.has(m.id)}
                        onToggleSelected={(event) => toggleMaterial(m, event)}
                        compact={density === 'compact'}
                        showImage={showImages}
                      />
                    ))}
                  </div>
                </div>
              )
            })}

            {sinCategoria.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h2 className="text-base font-bold text-foreground">Sin categoría</h2>
                  <Link
                    href="/materiales/nuevo"
                    className="btn-secondary btn-xs text-primary-soft-foreground"
                  >
                    <IconPlus className="w-3 h-3" />
                    <span>Nuevo material</span>
                  </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {sinCategoria.map((m) => (
                    <MaterialCard
                      key={m.id}
                      m={m}
                      puedeEditar={puedeEditar}
                      verPrecios={verPrecios}
                      onSelect={setPreviewMaterial}
                      selected={selectedIds.has(m.id)}
                      onToggleSelected={(event) => toggleMaterial(m, event)}
                      compact={density === 'compact'}
                      showImage={showImages}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed inset-x-3 bottom-[calc(var(--nav-height)+env(safe-area-inset-bottom,0px)+0.75rem)] z-40 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur-md lg:bottom-6 lg:left-[calc(var(--sidebar-current)+0.75rem)] print:hidden" role="region" aria-label="Acciones de materiales seleccionados">
          <p className="text-sm font-semibold text-foreground"><span className="tabular-nums">{selectedIds.size}</span> seleccionados</p>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-primary btn-sm" onClick={() => void exportSelected()}>Exportar CSV</button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setSelectedIds(new Set())}>Limpiar</button>
          </div>
        </div>
      )}

      {materiales.length === 0 && !hasLoadError && (
        <EmptyState
          icon={IconPaquete}
          title="El catálogo está vacío"
          description="Aún no se han dado de alta materiales en el catálogo."
          action={
            puedeEditar
              ? {
                  label: 'Nuevo material',
                  href: '/materiales/nuevo',
                  icon: IconPlus,
                }
              : undefined
          }
        />
      )}

      {/* 3. MODALES DE GESTIÓN DE CATEGORÍAS Y SUBCATEGORÍAS */}
      {modalType && (
        <div className="fixed inset-0 z-50 bg-foreground/50 flex items-center justify-center p-4 print:hidden" onMouseDown={(event) => event.target === event.currentTarget && cerrarModal()}>
          <div ref={categoryDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="category-dialog-title" className="bg-card rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl border border-border">
            <h3 id="category-dialog-title" className="text-base font-bold text-foreground">
              {modalType === 'nueva_cat' && 'Nueva categoría'}
              {modalType === 'editar_cat' && `Renombrar categoría: ${targetCat?.nombre}`}
              {modalType === 'eliminar_cat' && `Eliminar categoría: ${targetCat?.nombre}`}
              {modalType === 'nueva_sub' && `Nueva subcategoría en ${targetCat?.nombre}`}
              {modalType === 'editar_sub' && `Renombrar subcategoría: ${targetSub?.nombre}`}
              {modalType === 'eliminar_sub' && `Eliminar subcategoría: ${targetSub?.nombre}`}
            </h3>

            {formError && (
              <div className="p-2.5 rounded bg-danger-soft text-danger-soft-foreground text-xs border border-danger/30">
                {formError}
              </div>
            )}

            {modalType === 'eliminar_cat' ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  ¿Estás seguro de que deseas eliminar la categoría{' '}
                  <span className="font-semibold text-foreground">{targetCat?.nombre}</span>?
                </p>
                <p className="text-xs text-warning-soft-foreground bg-warning-soft p-2.5 rounded border border-warning/30">
                  Los materiales que estén en esta categoría pasarán a &quot;Sin categoría&quot; para que no se pierdan.
                </p>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={cerrarModal}
                    className="btn-secondary btn-xs"
                    disabled={isPending}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleGuardarModal}
                    className="btn-danger btn-xs"
                    disabled={isPending}
                  >
                    {isPending ? 'Eliminando...' : 'Sí, eliminar categoría'}
                  </button>
                </div>
              </div>
            ) : modalType === 'eliminar_sub' ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  ¿Estás seguro de que deseas eliminar la subcategoría{' '}
                  <span className="font-semibold text-foreground">{targetSub?.nombre}</span>?
                </p>
                <p className="text-xs text-warning-soft-foreground bg-warning-soft p-2.5 rounded border border-warning/30">
                  Los materiales asignados conservarán su categoría y su subcategoría quedará vacía.
                </p>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={cerrarModal}
                    className="btn-secondary btn-xs"
                    disabled={isPending}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleGuardarModal}
                    className="btn-danger btn-xs"
                    disabled={isPending}
                  >
                    {isPending ? 'Eliminando...' : 'Sí, eliminar subcategoría'}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleGuardarModal} className="space-y-4">
                <div>
                  <label htmlFor="modal_nombre" className="block text-xs font-semibold text-foreground mb-1">
                    Nombre *
                  </label>
                  <input
                    id="modal_nombre"
                    type="text"
                    required
                    value={inputNombre}
                    onChange={(e) => setInputNombre(e.target.value)}
                    className="input-base text-sm"
                    placeholder="Escribe el nombre..."
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={cerrarModal}
                    className="btn-secondary btn-xs"
                    disabled={isPending}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-primary btn-xs"
                    disabled={isPending || !inputNombre.trim()}
                  >
                    {isPending ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Vista previa de ficha técnica de material */}
      <MaterialPreviewModal
        material={previewMaterial}
        open={Boolean(previewMaterial)}
        onClose={() => setPreviewMaterial(null)}
        puedeEditar={puedeEditar}
        verPrecios={verPrecios}
      />
    </div>
  )
}
