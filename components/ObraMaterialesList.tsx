'use client'

import React, { useState, useMemo } from 'react'
import Image from 'next/image'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { EditTopeInline } from '@/components/EditTopeInline'
import { MaterialPreviewModal } from '@/components/MaterialPreviewModal'
import { IconPaquete, IconSearch } from '@/components/icons'
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
  const [materialSeleccionado, setMaterialSeleccionado] = useState<CatalogoMaterial | null>(null)
  const [modalAbierto, setModalAbierto] = useState(false)

  const topePorMaterial = useMemo(
    () => new Map(topes.map((t) => [t.material_id, t])),
    [topes]
  )

  // Filtrado reactivo en cliente
  const saldosFiltrados = useMemo(() => {
    const q = filtroTexto.toLowerCase().trim()
    if (!q) return saldos
    return saldos.filter(
      (s) =>
        s.nombre_base.toLowerCase().includes(q) ||
        (s.variante && s.variante.toLowerCase().includes(q)) ||
        (s.categoria && s.categoria.toLowerCase().includes(q)) ||
        (s.subcategoria && s.subcategoria.toLowerCase().includes(q))
    )
  }, [saldos, filtroTexto])

  // Agrupación por categoría / rubro
  const rubrosMap = useMemo(() => {
    const map = new Map<string, SaldoMaterialObra[]>()
    for (const s of saldosFiltrados) {
      const rubro = s.categoria?.trim() || 'Sin rubro'
      const arr = map.get(rubro) ?? []
      arr.push(s)
      map.set(rubro, arr)
    }
    return map
  }, [saldosFiltrados])

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
      {/* Buscador reactivo de materiales en el proyecto */}
      {saldos.length > 5 && (
        <div className="relative">
          <IconSearch className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            placeholder="Buscar material por nombre, variante o categoría en este proyecto…"
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

      {/* Listado agrupado */}
      <div className="space-y-6">
        {[...rubrosMap.entries()].map(([rubro, items]) => (
          <div key={rubro} className="space-y-3">
            <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
              <h3 className="text-sm font-bold text-ink uppercase tracking-wide">
                {rubro}
              </h3>
              <span className="text-xs text-gray-400 tabular-nums">
                {items.length} {items.length === 1 ? 'material' : 'materiales'}
              </span>
            </div>

            <div className="space-y-2">
              {items.map((s) => {
                const tope = topePorMaterial.get(s.material_id)
                const asignado = Number(s.cantidad_asignada ?? s.cantidad_contratada ?? 0)
                const enProceso = Number(s.cantidad_en_proceso ?? s.cantidad_comprometida ?? 0)
                const comprado = Number(s.cantidad_comprada ?? 0)
                const entregado = Number(s.cantidad_entregada ?? s.cantidad_usada ?? 0)
                const disponible = Number(s.cantidad_disponible ?? 0)
                const sinSaldo = disponible <= 0

                return (
                  <div
                    key={s.material_id}
                    className={`card ${sinSaldo ? 'border-red-200 bg-red-50/20' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Botón de vista previa de foto o placeholder */}
                      <button
                        type="button"
                        onClick={() => handleAbrirFicha(s)}
                        className="w-14 h-14 rounded-lg bg-gray-100 border border-gray-200 shrink-0 flex items-center justify-center overflow-hidden hover:opacity-90 hover:ring-2 hover:ring-accent transition-all group relative cursor-pointer"
                        title="Ver ficha técnica y foto ampliada"
                      >
                        {s.foto_url ? (
                          <Image
                            src={s.foto_url}
                            alt={s.nombre_base}
                            width={56}
                            height={56}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-gray-400 text-[11px] font-medium text-center px-1 leading-tight group-hover:text-accent">
                            Ver ficha
                          </span>
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => handleAbrirFicha(s)}
                            className="text-left group"
                          >
                            <p className="font-medium text-ink group-hover:text-accent transition-colors">
                              {s.nombre_base}
                              {s.variante && (
                                <span className="text-gray-500 font-normal"> · {s.variante}</span>
                              )}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                              <span>{s.unidad_medida}</span>
                              {s.subcategoria && (
                                <>
                                  <span>·</span>
                                  <span className="text-gray-400">{s.subcategoria}</span>
                                </>
                              )}
                            </div>
                          </button>

                          {sinSaldo && <Badge variant="red">Sin saldo</Badge>}
                        </div>
                      </div>
                    </div>

                    {/* Desglose de saldos */}
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                      <div className="bg-slate-50 p-2 rounded">
                        <p className="text-gray-500 font-medium">Asignado</p>
                        <p className="tabular-nums font-semibold text-gray-900 text-sm mt-0.5">{asignado}</p>
                      </div>
                      <div className="bg-slate-50 p-2 rounded">
                        <p className="text-gray-500 font-medium">En proceso</p>
                        <p className="tabular-nums font-semibold text-gray-900 text-sm mt-0.5">{enProceso}</p>
                      </div>
                      <div className="bg-slate-50 p-2 rounded">
                        <p className="text-gray-500 font-medium">Comprado</p>
                        <p className="tabular-nums font-semibold text-gray-900 text-sm mt-0.5">{comprado}</p>
                      </div>
                      <div className="bg-slate-50 p-2 rounded">
                        <p className="text-gray-500 font-medium">Entregado</p>
                        <p className="tabular-nums font-semibold text-gray-900 text-sm mt-0.5">{entregado}</p>
                      </div>
                      <div
                        className={`p-2 rounded col-span-2 sm:col-span-1 ${
                          sinSaldo ? 'bg-red-100/70' : 'bg-teal-50'
                        }`}
                      >
                        <p className={`font-semibold ${sinSaldo ? 'text-red-700' : 'text-teal-800'}`}>Disponible</p>
                        <p className={`tabular-nums font-bold text-sm mt-0.5 ${sinSaldo ? 'text-red-600' : 'text-teal-700'}`}>
                          {disponible}
                        </p>
                      </div>
                    </div>

                    {puedeTopes && tope && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <EditTopeInline
                          topeId={tope.id}
                          obraId={obraId}
                          materialId={s.material_id}
                          cantidadActual={Number(tope.cantidad_contratada)}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

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
