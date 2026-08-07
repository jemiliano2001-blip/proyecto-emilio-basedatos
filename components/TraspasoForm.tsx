'use client'

import { useMemo, useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import type { ActionResult } from '@/lib/actions/traspasos'

function BotonEnviarTraspaso({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="w-full bg-[#132A45] hover:bg-[#1f3f66] disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition text-base"
    >
      {pending ? 'Solicitando Traspaso...' : 'Solicitar Traspaso'}
    </button>
  )
}

interface ObraOption {
  id: string
  nombre: string
  fraccionamiento: string | null
}

interface MaterialOption {
  id: string
  nombre_base: string
  variante: string | null
  unidad_medida: string
}

interface SaldoItem {
  obra_id: string
  material_id: string
  cantidad_disponible: number
}

interface ItemSeleccionado {
  material_id: string
  nombre_base: string
  variante: string | null
  unidad_medida: string
  cantidad: number
  disponible: number
}

const initialState: ActionResult = { error: null }

export function TraspasoForm({
  action,
  obras,
  materiales,
  saldos,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>
  obras: ObraOption[]
  materiales: MaterialOption[]
  saldos: SaldoItem[]
}) {
  const [state, formAction] = useFormState(action, initialState)


  const [obraOrigenId, setObraOrigenId] = useState<string>(obras[0]?.id || '')
  const [obraDestinoId, setObraDestinoId] = useState<string>(
    obras.find((o) => o.id !== obras[0]?.id)?.id || ''
  )
  const [motivo, setMotivo] = useState<string>('')
  const [items, setItems] = useState<ItemSeleccionado[]>([])

  const [materialBusqueda, setMaterialBusqueda] = useState<string>('')
  const [materialIdSel, setMaterialIdSel] = useState<string>('')
  const [cantidadSel, setCantidadSel] = useState<string>('')
  const [errorLocal, setErrorLocal] = useState<string | null>(null)

  // Mapa de saldo disponible por material_id en la obra de origen actual
  const mapaSaldosOrigen = useMemo(() => {
    const map = new Map<string, number>()
    if (!obraOrigenId) return map
    for (const s of saldos) {
      if (s.obra_id === obraOrigenId) {
        map.set(s.material_id, Number(s.cantidad_disponible) || 0)
      }
    }
    return map
  }, [saldos, obraOrigenId])

  // Materiales filtrados por búsqueda
  const materialesFiltrados = useMemo(() => {
    const term = materialBusqueda.trim().toLowerCase()
    if (!term) return materiales
    return materiales.filter((m) => {
      const full = `${m.nombre_base} ${m.variante || ''}`.toLowerCase()
      return full.includes(term)
    })
  }, [materiales, materialBusqueda])

  const materialActual = useMemo(() => {
    return materiales.find((m) => m.id === materialIdSel) || null
  }, [materiales, materialIdSel])

  const disponibleActual = useMemo(() => {
    if (!materialIdSel) return 0
    return mapaSaldosOrigen.get(materialIdSel) || 0
  }, [mapaSaldosOrigen, materialIdSel])

  const handleAgregarItem = () => {
    setErrorLocal(null)
    if (!materialIdSel || !materialActual) {
      setErrorLocal('Selecciona un material de la lista.')
      return
    }

    const cant = parseFloat(cantidadSel)
    if (isNaN(cant) || cant <= 0) {
      setErrorLocal('Ingresa una cantidad mayor a cero.')
      return
    }

    if (cant > disponibleActual) {
      setErrorLocal(
        `La obra origen solo tiene ${disponibleActual} ${materialActual.unidad_medida} disponibles de este material.`
      )
      return
    }

    if (items.some((i) => i.material_id === materialIdSel)) {
      setErrorLocal('Este material ya fue agregado a la lista del traspaso.')
      return
    }

    setItems((prev) => [
      ...prev,
      {
        material_id: materialActual.id,
        nombre_base: materialActual.nombre_base,
        variante: materialActual.variante,
        unidad_medida: materialActual.unidad_medida,
        cantidad: cant,
        disponible: disponibleActual,
      },
    ])

    setMaterialIdSel('')
    setCantidadSel('')
    setMaterialBusqueda('')
  }

  const handleEliminarItem = (material_id: string) => {
    setItems((prev) => prev.filter((i) => i.material_id !== material_id))
  }

  const itemsJson = useMemo(() => {
    return JSON.stringify(
      items.map((i) => ({
        material_id: i.material_id,
        cantidad: i.cantidad,
      }))
    )
  }, [items])

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="items_json" value={itemsJson} />

      {(state.error || errorLocal) && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
          {state.error || errorLocal}
        </div>
      )}

      {/* Obra Origen y Destino */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-800 text-sm border-b pb-2">
          Selección de Proyectos
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Obra Origen (Sale el material) *
            </label>
            <select
              name="obra_origen_id"
              value={obraOrigenId}
              onChange={(e) => {
                setObraOrigenId(e.target.value)
                setItems([]) // Reiniciar lista si cambia la obra origen
              }}
              className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-[#132A45] focus:outline-none"
              required
            >
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre} {o.fraccionamiento ? `(${o.fraccionamiento})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Obra Destino (Entra el material) *
            </label>
            <select
              name="obra_destino_id"
              value={obraDestinoId}
              onChange={(e) => setObraDestinoId(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-[#132A45] focus:outline-none"
              required
            >
              {obras
                .filter((o) => o.id !== obraOrigenId)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre} {o.fraccionamiento ? `(${o.fraccionamiento})` : ''}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Motivo / Observaciones del Traspaso
          </label>
          <input
            type="text"
            name="motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej. Transferencia por requerimiento urgente de obra civil"
            className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#132A45] focus:outline-none"
          />
        </div>
      </div>

      {/* Agregar Materiales */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-800 text-sm border-b pb-2">
          Agregar Materiales al Traspaso
        </h2>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Buscar Material
            </label>
            <input
              type="text"
              value={materialBusqueda}
              onChange={(e) => setMaterialBusqueda(e.target.value)}
              placeholder="Escribe para buscar material..."
              className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-[#132A45] focus:outline-none mb-2"
            />

            <select
              value={materialIdSel}
              onChange={(e) => setMaterialIdSel(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-[#132A45] focus:outline-none"
            >
              <option value="">-- Selecciona un material --</option>
              {materialesFiltrados.map((m) => {
                const disp = mapaSaldosOrigen.get(m.id) || 0
                return (
                  <option key={m.id} value={m.id}>
                    {m.nombre_base} {m.variante ? `(${m.variante})` : ''} [{m.unidad_medida}] — Disp: {disp}
                  </option>
                )
              })}
            </select>
          </div>

          {materialActual && (
            <div className="bg-blue-50 p-3 rounded-lg flex items-center justify-between text-xs text-blue-800 border border-blue-100">
              <span>
                Material seleccionado: <strong>{materialActual.nombre_base} {materialActual.variante || ''}</strong>
              </span>
              <span>
                Disponible en origen: <strong>{disponibleActual} {materialActual.unidad_medida}</strong>
              </span>
            </div>
          )}

          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Cantidad a traspasar
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                max={disponibleActual}
                value={cantidadSel}
                onChange={(e) => setCantidadSel(e.target.value)}
                placeholder={`Máx ${disponibleActual}`}
                className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#132A45] focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleAgregarItem}
              className="bg-gray-800 hover:bg-black text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition shrink-0"
            >
              + Agregar
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Items Agregados */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
        <h2 className="font-semibold text-gray-800 text-sm border-b pb-2 flex items-center justify-between">
          <span>Materiales en el traspaso</span>
          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-normal">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </h2>

        {items.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">
            No has agregado materiales aún.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((item) => (
              <div key={item.material_id} className="py-2.5 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {item.nombre_base} {item.variante ? `(${item.variante})` : ''}
                  </p>
                  <p className="text-xs text-gray-500">
                    Cantidad: <strong className="text-[#132A45]">{item.cantidad} {item.unidad_medida}</strong> (de {item.disponible} disponibles)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleEliminarItem(item.material_id)}
                  className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 p-1.5 rounded transition"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <BotonEnviarTraspaso disabled={items.length === 0 || !obraOrigenId || !obraDestinoId} />
    </form>
  )
}
