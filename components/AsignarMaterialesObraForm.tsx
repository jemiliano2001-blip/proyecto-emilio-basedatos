'use client'

import { useMemo, useState } from 'react'
import { useFormState } from 'react-dom'
import type { ActionResult } from '@/lib/actions/topes'
import { FormError } from '@/components/FormError'
import { SubmitButton } from '@/components/SubmitButton'
import {
  IconPlus,
  IconBasura,
  IconRayo,
  IconChevron,
  IconCerrar,
  IconPaquete,
} from '@/components/icons'
import { formatMoneyMx, parseQuantity } from '@/lib/money'
import type { CatalogoMaterial, MaterialKitWithItems } from '@/lib/types'

const initialState: ActionResult = { error: null }

interface ComponenteKitAsignado {
  id: string
  material_id: string
  nombre_base: string
  variante: string | null
  unidad_medida: string
  cantidad: string
  precioUnitario: number
}

interface KitAsignado {
  instanceId: string
  kitId: string
  nombre: string
  configuracion: string | null
  multiplicador: number
  isExpanded: boolean
  componentes: ComponenteKitAsignado[]
}

interface PartidaSuela {
  key: string
  material_id: string
  cantidad: string
}

export function AsignarMaterialesObraForm({
  action,
  obraId: _obraId,
  obraNombre,
  materiales = [],
  kits = [],
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>
  obraId: string
  obraNombre: string
  materiales?: CatalogoMaterial[]
  kits?: MaterialKitWithItems[]
}) {
  const [state, formAction] = useFormState(action, initialState)

  // Kits estructurados asignados
  const [kitsAsignados, setKitsAsignados] = useState<KitAsignado[]>([])

  // Partidas individuales sueltas
  const [partidasSueltas, setPartidasSueltas] = useState<PartidaSuela[]>([
    { key: crypto.randomUUID(), material_id: '', cantidad: '1' },
  ])

  // Modal / Selector de Carga de Kits
  const [selectedKitId, setSelectedKitId] = useState<string>('')
  const [kitMultiplicador, setKitMultiplicador] = useState<string>('1')
  const [incluirEquipoPrincipal, setIncluirEquipoPrincipal] = useState<boolean>(true)
  const [mostrarModalKit, setMostrarModalKit] = useState<boolean>(false)

  // Mapa de materiales para búsqueda rápida
  const materialMap = useMemo(() => {
    return new Map(materiales.map((m) => [m.id, m]))
  }, [materiales])

  // Kits indexados por material principal (para sugerencias contextuales)
  const kitsPorMaterialPrincipal = useMemo(() => {
    const map = new Map<string, MaterialKitWithItems[]>()
    for (const k of kits) {
      if (k.material_principal_id) {
        const arr = map.get(k.material_principal_id) ?? []
        arr.push(k)
        map.set(k.material_principal_id, arr)
      }
    }
    return map
  }, [kits])

  // --- GESTIÓN DE KITS ---
  function abrirModalKitPara(kitId?: string) {
    if (kitId) setSelectedKitId(kitId)
    setKitMultiplicador('1')
    setIncluirEquipoPrincipal(true)
    setMostrarModalKit(true)
  }

  function handleInsertarKit() {
    if (!selectedKitId) return
    const kit = kits.find((k) => k.id === selectedKitId)
    if (!kit) return

    const factor = parseQuantity(kitMultiplicador) ?? 1
    const componentes: ComponenteKitAsignado[] = []

    // 1. Agregar el equipo principal si corresponde
    if (incluirEquipoPrincipal && kit.material_principal_id) {
      const matP = materialMap.get(kit.material_principal_id)
      if (matP) {
        componentes.push({
          id: crypto.randomUUID(),
          material_id: matP.id,
          nombre_base: matP.nombre_base,
          variante: matP.variante ?? null,
          unidad_medida: matP.unidad_medida,
          cantidad: String(factor),
          precioUnitario: Number(matP.precio_base ?? 0),
        })
      }
    }

    // 2. Agregar los accesorios y componentes del kit
    for (const item of kit.items ?? []) {
      const mat = item.material ?? materialMap.get(item.material_id)
      const cantTotal = item.cantidad * factor
      componentes.push({
        id: crypto.randomUUID(),
        material_id: item.material_id,
        nombre_base: mat?.nombre_base ?? item.nombre_base ?? 'Material',
        variante: mat?.variante ?? item.variante ?? null,
        unidad_medida: mat?.unidad_medida ?? item.unidad_medida ?? 'pza',
        cantidad: String(cantTotal),
        precioUnitario: Number(mat?.precio_base ?? item.precio_base ?? 0),
      })
    }

    const nuevoKit: KitAsignado = {
      instanceId: crypto.randomUUID(),
      kitId: kit.id,
      nombre: kit.nombre,
      configuracion: kit.configuracion ?? null,
      multiplicador: factor,
      isExpanded: true,
      componentes,
    }

    setKitsAsignados((prev) => [...prev, nuevoKit])

    // Limpiar fila vacía de partidas sueltas si aún no se ha seleccionado ningún material
    setPartidasSueltas((prev) => {
      if (prev.length === 1 && !prev[0].material_id) {
        return []
      }
      return prev
    })

    setSelectedKitId('')
    setKitMultiplicador('1')
    setMostrarModalKit(false)
  }

  function toggleExpandKit(instanceId: string) {
    setKitsAsignados((prev) =>
      prev.map((k) =>
        k.instanceId === instanceId ? { ...k, isExpanded: !k.isExpanded } : k
      )
    )
  }

  function eliminarKitCompleto(instanceId: string) {
    setKitsAsignados((prev) => prev.filter((k) => k.instanceId !== instanceId))
  }

  function actualizarCantidadComponenteKit(
    instanceId: string,
    componenteId: string,
    nuevaCantidad: string
  ) {
    setKitsAsignados((prev) =>
      prev.map((k) => {
        if (k.instanceId !== instanceId) return k
        return {
          ...k,
          componentes: k.componentes.map((c) =>
            c.id === componenteId ? { ...c, cantidad: nuevaCantidad } : c
          ),
        }
      })
    )
  }

  function eliminarComponenteDeKit(instanceId: string, componenteId: string) {
    setKitsAsignados((prev) =>
      prev.map((k) => {
        if (k.instanceId !== instanceId) return k
        return {
          ...k,
          componentes: k.componentes.filter((c) => c.id !== componenteId),
        }
      })
    )
  }

  // --- GESTIÓN DE PARTIDAS SUELTAS ---
  function agregarMaterialIndividual() {
    setPartidasSueltas((prev) => [
      ...prev,
      { key: crypto.randomUUID(), material_id: '', cantidad: '1' },
    ])
  }

  function actualizarPartidaSuela(key: string, cambios: Partial<PartidaSuela>) {
    setPartidasSueltas((prev) =>
      prev.map((p) => (p.key === key ? { ...p, ...cambios } : p))
    )
  }

  function quitarPartidaSuela(key: string) {
    setPartidasSueltas((prev) => prev.filter((p) => p.key !== key))
  }

  // --- CÁLCULO CONSOLIDADO TOTAL POR MATERIAL ---
  const { materialesConsolidados, totalCostoAdicional } = useMemo(() => {
    interface Acumulador {
      material_id: string
      nombre_base: string
      variante: string | null
      unidad_medida: string
      precioUnitario: number
      cantidadTotal: number
      origenes: string[]
    }

    const map = new Map<string, Acumulador>()

    // 1. Sumar componentes de kits
    for (const kit of kitsAsignados) {
      for (const comp of kit.componentes) {
        const cant = parseQuantity(comp.cantidad) ?? 0
        if (cant <= 0) continue

        const origenDesc = `Kit: ${kit.nombre} (${cant} ${comp.unidad_medida})`
        const exist = map.get(comp.material_id)
        if (exist) {
          exist.cantidadTotal += cant
          exist.origenes.push(origenDesc)
        } else {
          map.set(comp.material_id, {
            material_id: comp.material_id,
            nombre_base: comp.nombre_base,
            variante: comp.variante,
            unidad_medida: comp.unidad_medida,
            precioUnitario: comp.precioUnitario,
            cantidadTotal: cant,
            origenes: [origenDesc],
          })
        }
      }
    }

    // 2. Sumar partidas sueltas
    for (const p of partidasSueltas) {
      if (!p.material_id) continue
      const cant = parseQuantity(p.cantidad) ?? 0
      if (cant <= 0) continue

      const mat = materialMap.get(p.material_id)
      const origenDesc = `Individual (${cant} ${mat?.unidad_medida ?? 'u'})`
      const exist = map.get(p.material_id)
      if (exist) {
        exist.cantidadTotal += cant
        exist.origenes.push(origenDesc)
      } else {
        map.set(p.material_id, {
          material_id: p.material_id,
          nombre_base: mat?.nombre_base ?? 'Material',
          variante: mat?.variante ?? null,
          unidad_medida: mat?.unidad_medida ?? 'pza',
          precioUnitario: Number(mat?.precio_base ?? 0),
          cantidadTotal: cant,
          origenes: [origenDesc],
        })
      }
    }

    let totalCosto = 0
    const consolidados = Array.from(map.values()).map((item) => {
      const subtotal = Math.round(item.cantidadTotal * item.precioUnitario * 100) / 100
      totalCosto += subtotal
      return {
        ...item,
        subtotal,
      }
    })

    return {
      materialesConsolidados: consolidados,
      totalCostoAdicional: Math.round(totalCosto * 100) / 100,
    }
  }, [kitsAsignados, partidasSueltas, materialMap])

  // JSON consolidado para la acción del servidor
  const partidasJson = useMemo(() => {
    const list = materialesConsolidados.map((m) => ({
      material_id: m.material_id,
      cantidad: m.cantidadTotal,
    }))
    return JSON.stringify(list)
  }, [materialesConsolidados])

  const selectedKitObj = kits.find((k) => k.id === selectedKitId)

  return (
    <form
      action={formAction}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
          e.preventDefault()
        }
      }}
      className="space-y-6"
    >
      <input type="hidden" name="partidas_json" value={partidasJson} />
      <FormError message={state.error} />

      <div className="card space-y-5 border-teal-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-ink">
              Asignar Materiales a: {obraNombre}
            </h2>
            <p className="text-xs text-gray-500">
              Agrega ensambles/kits completos o partidas individuales. Los componentes son editables individualmente.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {kits.length > 0 && (
              <button
                type="button"
                onClick={() => abrirModalKitPara()}
                className="btn-secondary text-xs px-3 py-2 min-h-[38px] text-teal-800 border-teal-300 hover:bg-teal-50 flex items-center gap-1.5"
              >
                <IconRayo className="w-3.5 h-3.5 text-amber-500" />
                <span>Cargar Kit / Ensamble</span>
              </button>
            )}
            <button
              type="button"
              onClick={agregarMaterialIndividual}
              className="btn-primary text-xs px-3 py-2 min-h-[38px] flex items-center gap-1.5"
              disabled={materiales.length === 0}
            >
              <IconPlus className="w-3.5 h-3.5" />
              <span>Material individual</span>
            </button>
          </div>
        </div>

        {/* BANNER DE TOTAL CALCULADO */}
        <div className="rounded-xl bg-slate-900 text-white p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-300 font-medium">
              Costo Adicional a Sumar al Presupuesto
            </p>
            <p className="text-2xl font-bold tabular-nums text-teal-300">
              +{formatMoneyMx(totalCostoAdicional)}
            </p>
          </div>
          <div className="text-right text-xs text-slate-300">
            <span className="font-semibold text-white">
              {materialesConsolidados.length}
            </span>{' '}
            {materialesConsolidados.length === 1 ? 'material único' : 'materiales únicos'}{' '}
            a incorporar
          </div>
        </div>

        {/* MODAL DE CARGA DE KIT / ENSAMBLE */}
        {mostrarModalKit && (
          <div className="p-4 rounded-xl bg-teal-50/80 border border-teal-200 space-y-3 animate-fade-in shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded bg-teal-600 text-white">
                  <IconRayo className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-bold text-teal-900">
                  Seleccionar Kit / Ensamble Compuesto
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setMostrarModalKit(false)}
                className="text-gray-400 hover:text-gray-700 p-1"
                aria-label="Cerrar modal"
              >
                <IconCerrar className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-teal-700">
              Al cargar el kit se creará un grupo jerárquico donde podrás modificar las cantidades de cada accesorio o quitar los que no utilices.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Plantilla de Ensamble
                </label>
                <select
                  value={selectedKitId}
                  onChange={(e) => setSelectedKitId(e.target.value)}
                  className="input-base text-sm bg-white"
                >
                  <option value="">-- Elige un kit o ensamble --</option>
                  {kits.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nombre} {k.configuracion ? `(${k.configuracion})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Cantidad de Kits
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={kitMultiplicador}
                  onChange={(e) => setKitMultiplicador(e.target.value)}
                  className="input-base text-sm bg-white text-center font-medium"
                  placeholder="1"
                />
              </div>
            </div>

            {selectedKitObj && selectedKitObj.material_principal_id && (
              <label className="flex items-center gap-2 text-xs text-teal-900 font-medium cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={incluirEquipoPrincipal}
                  onChange={(e) => setIncluirEquipoPrincipal(e.target.checked)}
                  className="rounded border-teal-300 text-teal-700 focus:ring-teal-600"
                />
                <span>
                  Incluir equipo principal ({selectedKitObj.nombre}) en las partidas contratadas
                </span>
              </label>
            )}

            {selectedKitObj && selectedKitObj.items && selectedKitObj.items.length > 0 && (
              <div className="bg-white rounded-lg p-3 border border-teal-100 space-y-2">
                <p className="text-xs font-semibold text-gray-600">
                  Componentes incluidos ({selectedKitObj.items.length}):
                </p>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1 text-xs">
                  {selectedKitObj.items.map((it) => (
                    <div
                      key={it.id}
                      className="flex items-center justify-between text-gray-700 py-1 border-b border-gray-50 last:border-none"
                    >
                      <span>
                        {it.nombre_base ?? it.material?.nombre_base}
                        {(it.variante ?? it.material?.variante)
                          ? ` · ${it.variante ?? it.material?.variante}`
                          : ''}
                      </span>
                      <span className="font-semibold tabular-nums text-teal-800">
                        {(it.cantidad * (parseQuantity(kitMultiplicador) ?? 1)).toFixed(2)}{' '}
                        {it.unidad_medida ?? it.material?.unidad_medida}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setMostrarModalKit(false)}
                className="btn-secondary text-xs px-3 py-1.5 min-h-[34px]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleInsertarKit}
                disabled={!selectedKitId}
                className="btn-primary text-xs px-4 py-1.5 min-h-[34px] bg-teal-800"
              >
                Cargar Kit al Proyecto
              </button>
            </div>
          </div>
        )}

        {/* 1. SECCIÓN DE KITS / ENSAMBLES ASIGNADOS (JERÁRQUICOS Y COLAPSIBLES) */}
        {kitsAsignados.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-1">
              <h3 className="text-xs font-bold text-teal-900 uppercase tracking-wider flex items-center gap-1.5">
                <IconRayo className="w-3.5 h-3.5 text-amber-500" />
                <span>Kits y Ensambles ({kitsAsignados.length})</span>
              </h3>
              <span className="text-xs text-gray-400">
                Componentes editables por ensamble
              </span>
            </div>

            <div className="space-y-3">
              {kitsAsignados.map((kit) => {
                const subtotalKit = kit.componentes.reduce((acc, c) => {
                  const cant = parseQuantity(c.cantidad) ?? 0
                  return acc + cant * c.precioUnitario
                }, 0)

                return (
                  <div
                    key={kit.instanceId}
                    className="border-2 border-teal-600/30 bg-teal-50/15 rounded-xl overflow-hidden shadow-sm transition-all"
                  >
                    {/* Header del Kit Asignado */}
                    <div className="bg-slate-50 border-b border-gray-200 p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => toggleExpandKit(kit.instanceId)}
                          className="p-1 rounded text-gray-500 hover:text-navy hover:bg-gray-200 transition-colors"
                          title={kit.isExpanded ? 'Colapsar componentes' : 'Expandir componentes'}
                        >
                          <IconChevron
                            className={`w-4 h-4 transition-transform duration-200 ${
                              kit.isExpanded ? 'rotate-90 text-teal-800' : ''
                            }`}
                          />
                        </button>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-navy">
                              {kit.nombre}
                            </span>
                            {kit.configuracion && (
                              <span className="text-xs font-normal text-gray-500">
                                ({kit.configuracion})
                              </span>
                            )}
                            <span className="badge-teal text-[11px] font-semibold">
                              x{kit.multiplicador} {kit.multiplicador === 1 ? 'kit' : 'kits'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {kit.componentes.length} componentes · Costo ensamble:{' '}
                            <strong className="text-gray-800">
                              {formatMoneyMx(subtotalKit)}
                            </strong>
                          </p>
                        </div>
                      </div>

                      {/* Botón de 1-Clic para Borrar el Kit Completo */}
                      <button
                        type="button"
                        onClick={() => eliminarKitCompleto(kit.instanceId)}
                        className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 px-2.5 py-1.5 rounded border border-red-200 transition-colors inline-flex items-center gap-1 shrink-0 font-medium"
                        title="Eliminar este kit completo y todos sus componentes"
                      >
                        <IconBasura className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Eliminar Kit</span>
                      </button>
                    </div>

                    {/* Lista Expandible de Componentes del Kit */}
                    {kit.isExpanded && (
                      <div className="p-3 space-y-2 bg-white animate-fade-in">
                        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-2 grid grid-cols-12 gap-2">
                          <span className="col-span-6 sm:col-span-6">Componente</span>
                          <span className="col-span-3 sm:col-span-2 text-center">Cantidad</span>
                          <span className="hidden sm:block sm:col-span-2 text-right">Precio unit.</span>
                          <span className="col-span-3 sm:col-span-2 text-right">Subtotal</span>
                        </div>

                        {kit.componentes.map((comp) => {
                          const cantNum = parseQuantity(comp.cantidad) ?? 0
                          const subtotalComp = cantNum * comp.precioUnitario

                          return (
                            <div
                              key={comp.id}
                              className="p-2 rounded-lg border border-gray-100 hover:border-gray-200 bg-slate-50/50 grid grid-cols-12 gap-2 items-center text-xs"
                            >
                              <div className="col-span-6 sm:col-span-6 min-w-0">
                                <p className="font-semibold text-gray-900 truncate">
                                  {comp.nombre_base}
                                </p>
                                <div className="text-[11px] text-gray-500 truncate">
                                  {comp.variante && <span>{comp.variante} · </span>}
                                  <span>{comp.unidad_medida}</span>
                                </div>
                              </div>

                              <div className="col-span-3 sm:col-span-2">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={comp.cantidad}
                                  onChange={(e) =>
                                    actualizarCantidadComponenteKit(
                                      kit.instanceId,
                                      comp.id,
                                      e.target.value
                                    )
                                  }
                                  className="input-base text-xs text-center font-semibold py-1 bg-white"
                                  title="Editar cantidad para este kit"
                                />
                              </div>

                              <div className="hidden sm:block sm:col-span-2 text-right text-gray-600 tabular-nums">
                                {formatMoneyMx(comp.precioUnitario)}
                              </div>

                              <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-1.5">
                                <span className="font-bold text-gray-900 tabular-nums">
                                  {formatMoneyMx(subtotalComp)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    eliminarComponenteDeKit(kit.instanceId, comp.id)
                                  }
                                  className="text-gray-400 hover:text-red-600 p-0.5 rounded"
                                  title="Quitar este componente del kit"
                                >
                                  <IconCerrar className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )
                        })}

                        {kit.componentes.length === 0 && (
                          <p className="text-center text-xs text-gray-400 py-3">
                            Este kit no tiene componentes asignados.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 2. SECCIÓN DE MATERIALES INDIVIDUALES */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-gray-200 pb-1">
            <h3 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
              <IconPaquete className="w-3.5 h-3.5 text-gray-500" />
              <span>Partidas Individuales ({partidasSueltas.length})</span>
            </h3>
            <button
              type="button"
              onClick={agregarMaterialIndividual}
              className="text-xs text-teal-800 hover:underline font-semibold inline-flex items-center gap-1"
            >
              <IconPlus className="w-3 h-3" />
              <span>Añadir partida suelta</span>
            </button>
          </div>

          <div className="space-y-2">
            {partidasSueltas.map((item, index) => {
              const mat = item.material_id ? materialMap.get(item.material_id) : null
              const cantNum = parseQuantity(item.cantidad) ?? 0
              const precioUnit = Number(mat?.precio_base ?? 0)
              const subtotal = cantNum * precioUnit

              return (
                <div
                  key={item.key}
                  className="card border-gray-200 bg-white p-3 space-y-2 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-gray-400">
                      Partida #{index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => quitarPartidaSuela(item.key)}
                      className="text-xs text-red-600 font-semibold hover:text-red-800 py-0.5 inline-flex items-center gap-1"
                    >
                      <IconBasura className="w-3.5 h-3.5" />
                      <span>Quitar</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <div className="sm:col-span-6">
                      <select
                        value={item.material_id}
                        onChange={(e) =>
                          actualizarPartidaSuela(item.key, {
                            material_id: e.target.value,
                          })
                        }
                        className="input-base text-sm"
                      >
                        <option value="">Selecciona material del catálogo</option>
                        {materiales.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nombre_base}
                            {m.variante ? ` · ${m.variante}` : ''} ({m.unidad_medida})
                            {m.precio_base ? ` — $${m.precio_base}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Cantidad"
                        value={item.cantidad}
                        onChange={(e) =>
                          actualizarPartidaSuela(item.key, {
                            cantidad: e.target.value,
                          })
                        }
                        className="input-base text-sm text-center font-medium"
                      />
                    </div>

                    <div className="sm:col-span-2 text-right sm:text-left text-xs text-gray-600 tabular-nums">
                      {formatMoneyMx(precioUnit)}
                      <span className="text-[11px] text-gray-400 ml-1">
                        /{mat?.unidad_medida ?? 'u'}
                      </span>
                    </div>

                    <div className="sm:col-span-2 text-right text-sm font-bold text-ink tabular-nums">
                      {formatMoneyMx(subtotal)}
                    </div>
                  </div>

                  {/* Sugerencia contextual de kit si se seleccionó un equipo con kit */}
                  {(() => {
                    const kitsRel = item.material_id
                      ? kitsPorMaterialPrincipal.get(item.material_id) ?? []
                      : []
                    if (kitsRel.length === 0) return null
                    return (
                      <div className="mt-1 pt-1.5 border-t border-teal-100 flex flex-wrap items-center gap-2 text-xs bg-teal-50/60 p-2 rounded">
                        <span className="text-teal-900 font-medium inline-flex items-center gap-1">
                          <IconRayo className="w-3.5 h-3.5 text-amber-500" />
                          <span>Ensambles recomendados para este equipo:</span>
                        </span>
                        {kitsRel.map((k) => (
                          <button
                            key={k.id}
                            type="button"
                            onClick={() => abrirModalKitPara(k.id)}
                            className="px-2 py-0.5 rounded bg-white border border-teal-300 text-teal-800 font-semibold hover:bg-teal-100 shadow-sm"
                          >
                            + {k.configuracion || k.nombre}
                          </button>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              )
            })}

            {partidasSueltas.length === 0 && kitsAsignados.length === 0 && (
              <div className="text-center py-6 border border-dashed border-gray-300 rounded-xl space-y-2">
                <p className="text-xs font-medium text-gray-500">
                  No hay partidas individuales ni kits seleccionados.
                </p>
                <button
                  type="button"
                  onClick={agregarMaterialIndividual}
                  className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 mx-auto"
                >
                  <IconPlus className="w-3.5 h-3.5" />
                  <span>Agregar primera partida</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 3. RESUMEN CONSOLIDADO DE CANTIDADES TOTALES */}
        {materialesConsolidados.length > 0 && (
          <div className="mt-6 pt-4 border-t-2 border-dashed border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                  <span>Resumen Consolidado de Asignación</span>
                  <span className="badge-teal text-xs">
                    {materialesConsolidados.length} partidas finales
                  </span>
                </h3>
                <p className="text-xs text-gray-500">
                  Cantidades totales que se registrarán en el presupuesto contratado del proyecto.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
              <div className="max-h-60 overflow-y-auto divide-y divide-gray-200">
                {materialesConsolidados.map((item) => (
                  <div
                    key={item.material_id}
                    className="p-2.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-white transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">
                          {item.nombre_base}
                        </span>
                        {item.variante && (
                          <span className="text-gray-500">· {item.variante}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                        Origen: {item.origenes.join(' + ')}
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                      <div className="text-right">
                        <span className="text-[11px] text-gray-400 block sm:hidden">
                          Cantidad:
                        </span>
                        <span className="font-bold text-teal-800 text-sm tabular-nums">
                          {item.cantidadTotal} {item.unidad_medida}
                        </span>
                      </div>

                      <div className="text-right sm:w-28">
                        <span className="text-[11px] text-gray-400 block sm:hidden">
                          Costo:
                        </span>
                        <span className="font-semibold text-gray-800 tabular-nums">
                          {formatMoneyMx(item.subtotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-slate-100 p-3 flex items-center justify-between border-t border-slate-200 font-semibold text-xs text-slate-800">
                <span>Total consolidado a incorporar</span>
                <span className="text-sm font-bold text-teal-900 tabular-nums">
                  {formatMoneyMx(totalCostoAdicional)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <SubmitButton
        disabled={materialesConsolidados.length === 0}
        className="btn-primary w-full py-3 text-sm font-semibold"
      >
        Guardar y Asignar al Proyecto
      </SubmitButton>
    </form>
  )
}
