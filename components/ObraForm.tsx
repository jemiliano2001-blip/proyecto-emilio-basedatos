'use client'

import { useMemo, useState } from 'react'
import { useFormState } from 'react-dom'
import type { ActionResult } from '@/lib/actions/obras'
import { FormError } from '@/components/FormError'
import { SubmitButton } from '@/components/SubmitButton'
import { IconPlus, IconBasura, IconRayo } from '@/components/icons'
import { formatMoneyMx, parseQuantity } from '@/lib/money'
import type { CatalogoMaterial, MaterialKitWithItems, Obra } from '@/lib/types'

const initialState: ActionResult = { error: null }

interface PartidaPresupuesto {
  key: string
  material_id: string
  cantidad: string
  origenKitNombre?: string
}

export function ObraForm({
  action,
  obra,
  submitLabel,
  materiales = [],
  kits = [],
  allowTopesOnCreate = false,
  isEdit = false,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>
  obra?: Pick<
    Obra,
    | 'nombre'
    | 'cliente'
    | 'ciudad'
    | 'fraccionamiento'
    | 'paquete'
    | 'ubicacion'
    | 'estado'
    | 'presupuesto_mxn'
  >
  submitLabel: string
  materiales?: CatalogoMaterial[]
  kits?: MaterialKitWithItems[]
  allowTopesOnCreate?: boolean
  isEdit?: boolean
}) {
  const [state, formAction] = useFormState(action, initialState)
  const [partidas, setPartidas] = useState<PartidaPresupuesto[]>([])

  // Modal / Selector de Kits
  const [selectedKitId, setSelectedKitId] = useState<string>('')
  const [kitMultiplicador, setKitMultiplicador] = useState<string>('1')
  const [mostrarModalKit, setMostrarModalKit] = useState<boolean>(false)

  // Mapa de materiales para búsqueda rápida
  const materialMap = useMemo(() => {
    return new Map(materiales.map((m) => [m.id, m]))
  }, [materiales])

  // Kits indexados por material_principal_id para sugerencias automáticas
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

  // Cálculo en vivo del subtotal por partida y del presupuesto total estimado
  const { itemsConCalculo, totalPresupuestoCalculado } = useMemo(() => {
    let total = 0
    const items = partidas.map((p) => {
      const mat = p.material_id ? materialMap.get(p.material_id) : null
      const cantNum = parseQuantity(p.cantidad) ?? 0
      const precioUnitario = Number(mat?.precio_base ?? 0)
      const subtotal = cantNum * precioUnitario
      total += subtotal
      return {
        ...p,
        material: mat,
        cantNum,
        precioUnitario,
        subtotal,
      }
    })
    return { itemsConCalculo: items, totalPresupuestoCalculado: total }
  }, [partidas, materialMap])

  const topesJson = useMemo(
    () =>
      JSON.stringify(
        partidas
          .filter((t) => t.material_id && t.cantidad.trim() !== '')
          .map((t) => ({
            material_id: t.material_id,
            cantidad_contratada: t.cantidad,
          }))
      ),
    [partidas]
  )

  function agregarMaterialIndividual() {
    setPartidas((prev) => [
      ...prev,
      { key: crypto.randomUUID(), material_id: '', cantidad: '1' },
    ])
  }

  function actualizarPartida(key: string, cambios: Partial<PartidaPresupuesto>) {
    setPartidas((prev) => prev.map((t) => (t.key === key ? { ...t, ...cambios } : t)))
  }

  function quitarPartida(key: string) {
    setPartidas((prev) => prev.filter((t) => t.key !== key))
  }

  function materialesDisponibles(key: string) {
    const usados = new Set(
      partidas.filter((t) => t.key !== key && t.material_id).map((t) => t.material_id)
    )
    return materiales.filter((m) => !usados.has(m.id))
  }

  // Cargar conjunto de materiales secundarios de un kit
  function aplicarKitConcreto(kitId: string, cantidadBase: number) {
    const kit = kits.find((k) => k.id === kitId)
    if (!kit || !kit.items || kit.items.length === 0) return

    const factor = cantidadBase > 0 ? cantidadBase : 1

    setPartidas((prev) => {
      const nuevas = [...prev]
      const mapaExistentes = new Map(nuevas.map((p, idx) => [p.material_id, idx]))

      for (const item of kit.items) {
        const cantToAdd = item.cantidad * factor
        if (mapaExistentes.has(item.material_id)) {
          const idx = mapaExistentes.get(item.material_id)!
          const cantActual = parseQuantity(nuevas[idx].cantidad) ?? 0
          nuevas[idx] = {
            ...nuevas[idx],
            cantidad: String(cantActual + cantToAdd),
            origenKitNombre: kit.nombre,
          }
        } else {
          nuevas.push({
            key: crypto.randomUUID(),
            material_id: item.material_id,
            cantidad: String(cantToAdd),
            origenKitNombre: kit.nombre,
          })
          mapaExistentes.set(item.material_id, nuevas.length - 1)
        }
      }
      return nuevas
    })
  }

  function aplicarKit() {
    if (!selectedKitId) return
    const factor = parseQuantity(kitMultiplicador) ?? 1
    aplicarKitConcreto(selectedKitId, factor)
    setSelectedKitId('')
    setKitMultiplicador('1')
    setMostrarModalKit(false)
  }

  const selectedKitObj = kits.find((k) => k.id === selectedKitId)

  return (
    <form action={formAction} className="space-y-6">
      <input
        type="hidden"
        name="topes_json"
        value={allowTopesOnCreate ? topesJson : '[]'}
      />
      <input
        type="hidden"
        name="presupuesto_mxn"
        value={
          allowTopesOnCreate
            ? String(totalPresupuestoCalculado)
            : String(obra?.presupuesto_mxn ?? 0)
        }
      />

      <FormError message={state.error} />

      {/* SECCIÓN 1: DATOS GENERALES DEL PROYECTO */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
          Datos del Proyecto
        </h2>

        <div>
          <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">
            Nombre del proyecto *
          </label>
          <input
            id="nombre"
            name="nombre"
            required
            defaultValue={obra?.nombre ?? ''}
            className="input-base"
            placeholder="ej. Fraccionamiento Los Olivos - Etapa 1"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="cliente" className="block text-sm font-medium text-gray-700 mb-1">
              Cliente
            </label>
            <input
              id="cliente"
              name="cliente"
              defaultValue={obra?.cliente ?? ''}
              className="input-base"
              placeholder="Nombre del cliente o desarrolladora"
            />
          </div>

          <div>
            <label htmlFor="ciudad" className="block text-sm font-medium text-gray-700 mb-1">
              Ciudad / Municipio
            </label>
            <input
              id="ciudad"
              name="ciudad"
              defaultValue={obra?.ciudad ?? ''}
              className="input-base"
              placeholder="ej. Matamoros, Reynosa, Querétaro"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="fraccionamiento" className="block text-sm font-medium text-gray-700 mb-1">
              Fraccionamiento / Colonia
            </label>
            <input
              id="fraccionamiento"
              name="fraccionamiento"
              defaultValue={obra?.fraccionamiento ?? ''}
              className="input-base"
              placeholder="ej. Residencial Los Olivos"
            />
          </div>

          <div>
            <label htmlFor="estado" className="block text-sm font-medium text-gray-700 mb-1">
              Estatus
            </label>
            <select
              id="estado"
              name="estado"
              defaultValue={obra?.estado ?? 'activa'}
              className="input-base"
            >
              <option value="activa">Activo</option>
              <option value="pausada">Pausado</option>
              
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="ubicacion" className="block text-sm font-medium text-gray-700 mb-1">
            Ubicación detallada (Dirección o referencias)
          </label>
          <input
            id="ubicacion"
            name="ubicacion"
            defaultValue={obra?.ubicacion ?? ''}
            className="input-base"
            placeholder="ej. Av. Universidad #120 / Carretera a Reynosa Km 5"
          />
        </div>
      </div>

      {/* SECCIÓN 2: PRESUPUESTO DE MATERIALES Y KITS CON CÁLCULO AUTOMÁTICO */}
      {allowTopesOnCreate && (
        <div className="card space-y-4 border-teal-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-ink">
                Presupuesto de Materiales Asignados
              </h2>
              <p className="text-xs text-gray-500">
                El presupuesto global se calcula automáticamente: Cantidad Asignada × Precio Base.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {kits.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMostrarModalKit(true)}
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
          <div className="rounded-xl bg-slate-900 text-white p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-300 font-medium">
                Presupuesto Estimado del Proyecto
              </p>
              <p className="text-2xl font-bold tabular-nums text-teal-300">
                {formatMoneyMx(totalPresupuestoCalculado)}
              </p>
            </div>
            <div className="text-right text-xs text-slate-300">
              <span className="font-semibold text-white">{partidas.length}</span> partidas asignadas
            </div>
          </div>

          {/* MODAL / SECCIÓN DE CARGA DE KIT */}
          {mostrarModalKit && (
            <div className="p-4 rounded-lg bg-teal-50/70 border border-teal-200 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-teal-900">
                  Seleccionar Kit / Ensamble Compuesto
                </h3>
                <button
                  type="button"
                  onClick={() => setMostrarModalKit(false)}
                  className="text-xs text-gray-500 hover:text-gray-800 font-semibold"
                >
                  Cerrar
                </button>
              </div>
              <p className="text-xs text-teal-700">
                Al seleccionar una plantilla (ej. Transformador de paso o remate), se añadirán automáticamente sus accesorios, conectores, cableado y herrajes asociados.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Plantilla / Kit
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
                    className="input-base text-sm bg-white"
                    placeholder="1"
                  />
                </div>
              </div>

              {selectedKitObj && selectedKitObj.items && selectedKitObj.items.length > 0 && (
                <div className="bg-white rounded-lg p-3 border border-teal-100 space-y-2">
                  <p className="text-xs font-semibold text-gray-600">
                    Componentes incluidos en este ensamble:
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
                  onClick={aplicarKit}
                  disabled={!selectedKitId}
                  className="btn-primary text-xs px-4 py-1.5 min-h-[34px] bg-teal-800"
                >
                  Insertar partidas del Kit
                </button>
              </div>
            </div>
          )}

          {/* LISTADO INTERACTIVO DE PARTIDAS */}
          <div className="space-y-3">
            {itemsConCalculo.map((item, index) => (
              <div
                key={item.key}
                className="card border-gray-200 bg-white p-3 sm:p-4 space-y-2 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400">
                      #{index + 1}
                    </span>
                    {item.origenKitNombre && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-teal-50 text-teal-700 font-medium">
                        Kit: {item.origenKitNombre}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => quitarPartida(item.key)}
                    className="text-xs text-red-600 font-semibold hover:text-red-800 py-1 inline-flex items-center gap-1"
                  >
                    <IconBasura className="w-3.5 h-3.5" />
                    <span>Quitar</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  <div className="sm:col-span-6">
                    <select
                      value={item.material_id}
                      onChange={(e) =>
                        actualizarPartida(item.key, { material_id: e.target.value })
                      }
                      className="input-base text-sm"
                      required
                    >
                      <option value="">Selecciona material del catálogo</option>
                      {materialesDisponibles(item.key).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nombre_base}
                          {m.variante ? ` · ${m.variante}` : ''} ({m.unidad_medida})
                          {m.precio_base ? ` — $${m.precio_base}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-gray-500 mb-0.5 sm:hidden">
                      Cantidad asignada
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Cantidad"
                      value={item.cantidad}
                      onChange={(e) =>
                        actualizarPartida(item.key, { cantidad: e.target.value })
                      }
                      className="input-base text-sm text-center font-medium"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2 text-right sm:text-left">
                    <span className="text-[11px] text-gray-400 block sm:hidden">
                      Precio Base:
                    </span>
                    <span className="text-xs text-gray-600 tabular-nums">
                      {formatMoneyMx(item.precioUnitario)}
                    </span>
                    <span className="text-[11px] text-gray-400 ml-1">
                      /{item.material?.unidad_medida ?? 'u'}
                    </span>
                  </div>

                  <div className="sm:col-span-2 text-right">
                    <span className="text-[11px] text-gray-400 block sm:hidden">
                      Subtotal:
                    </span>
                    <span className="text-sm font-bold text-ink tabular-nums">
                      {formatMoneyMx(item.subtotal)}
                    </span>
                  </div>
                </div>

                {/* SUGERENCIA RÁPIDA DE ACCESORIOS / KITS (ej. Transformadores) */}
                {(() => {
                  const kitsRelacionados = item.material_id
                    ? kitsPorMaterialPrincipal.get(item.material_id) ?? []
                    : []
                  if (kitsRelacionados.length === 0) return null
                  return (
                    <div className="mt-2 pt-2 border-t border-teal-100 flex flex-wrap items-center gap-2 text-xs bg-teal-50/60 p-2 rounded">
                      <span className="text-teal-900 font-medium inline-flex items-center gap-1">
                        <IconRayo className="w-3.5 h-3.5 text-amber-500" />
                        <span>Equipo con ensamble ({kitsRelacionados[0].nombre}):</span>
                      </span>
                      {kitsRelacionados.map((k) => (
                        <button
                          key={k.id}
                          type="button"
                          onClick={() => aplicarKitConcreto(k.id, item.cantNum || 1)}
                          className="px-2 py-1 rounded bg-white border border-teal-300 text-teal-800 font-semibold hover:bg-teal-100 shadow-sm"
                        >
                          + {k.configuracion || k.nombre}
                        </button>
                      ))}
                    </div>
                  )
                })()}
              </div>
            ))}

            {partidas.length === 0 && (
              <div className="text-center py-8 border border-dashed border-gray-300 rounded-xl space-y-2">
                <p className="text-sm font-medium text-gray-600">
                  No has agregado materiales a este presupuesto.
                </p>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  Agrega materiales individuales o utiliza una plantilla/kit compuesto para cargar automáticamente los accesorios y calcular el presupuesto.
                </p>
                <div className="pt-2 flex justify-center gap-2">
                  {kits.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setMostrarModalKit(true)}
                      className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
                    >
                      <IconRayo className="w-3.5 h-3.5 text-amber-500" />
                      <span>Usar Kit</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={agregarMaterialIndividual}
                    className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
                  >
                    <IconPlus className="w-3.5 h-3.5" />
                    <span>Agregar material</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EN MODO EDICIÓN SIN TOPES EN CREACIÓN, SE PUEDE VISUALIZAR EL PRESUPUESTO */}
      {isEdit && !allowTopesOnCreate && obra?.presupuesto_mxn !== undefined && (
        <div className="card space-y-2">
          <label htmlFor="presupuesto_mxn_edit" className="block text-sm font-medium text-gray-700">
            Presupuesto (MXN)
          </label>
          <input
            id="presupuesto_mxn_edit"
            name="presupuesto_mxn"
            inputMode="decimal"
            defaultValue={String(obra.presupuesto_mxn)}
            className="input-base"
          />
        </div>
      )}

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  )
}
