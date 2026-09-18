'use client'

import { useActionState, useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'
import type { ActionResult } from '@/lib/actions/traspasos'
import { parseQuantity } from '@/lib/money'

function BotonEnviarTraspaso({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className="btn-primary w-full"
    >
      {pending ? 'Solicitando traspaso…' : 'Solicitar traspaso'}
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
  const [state, formAction] = useActionState(action, initialState)


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

    const cant = parseQuantity(cantidadSel)
    if (cant === null || cant <= 0) {
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
        <div className="bg-danger-soft border border-danger/30 text-danger-soft-foreground p-3 rounded-lg text-sm">
          {state.error || errorLocal}
        </div>
      )}

      {/* Obra Origen y Destino */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-foreground text-sm border-b border-border pb-2">
          Selección de Proyectos
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Proyecto origen (sale el material) *
            </label>
            <select
              name="obra_origen_id"
              value={obraOrigenId}
              onChange={(e) => {
                const nuevaOrigen = e.target.value
                setObraOrigenId(nuevaOrigen)
                setItems([]) // Reiniciar lista si cambia la obra origen
                setMaterialIdSel('')
                setCantidadSel('')
                setMaterialBusqueda('')
                setErrorLocal(null)
                if (obraDestinoId === nuevaOrigen) {
                  const otra = obras.find((o) => o.id !== nuevaOrigen)
                  if (otra) setObraDestinoId(otra.id)
                }
              }}
              className="input-base text-sm"
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
            <label className="block text-xs font-semibold text-foreground mb-1">
              Proyecto destino (entra el material) *
            </label>
            <select
              name="obra_destino_id"
              value={obraDestinoId}
              onChange={(e) => setObraDestinoId(e.target.value)}
              className="input-base text-sm"
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
          <label className="block text-xs font-semibold text-foreground mb-1">
            Motivo / Observaciones del traspaso
          </label>
          <input
            type="text"
            name="motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej. Transferencia por requerimiento urgente de obra civil"
            className="input-base text-sm"
          />
        </div>
      </div>

      {/* Agregar Materiales */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-foreground text-sm border-b border-border pb-2">
          Agregar Materiales al Traspaso
        </h2>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Buscar material
            </label>
            <input
              type="text"
              value={materialBusqueda}
              onChange={(e) => setMaterialBusqueda(e.target.value)}
              placeholder="Escribe para buscar material..."
              className="input-base text-sm mb-2"
            />

            <select
              value={materialIdSel}
              onChange={(e) => setMaterialIdSel(e.target.value)}
              className="input-base text-sm"
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
            <div className="bg-primary-soft p-3 rounded-lg flex items-center justify-between text-xs text-primary-soft-foreground border border-primary/20">
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
              <label className="block text-xs font-semibold text-foreground mb-1">
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
                className="input-base text-sm"
              />
            </div>
            <button
              type="button"
              onClick={handleAgregarItem}
              className="btn-primary text-xs px-4 py-3 shrink-0"
            >
              Agregar
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Items Agregados */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-foreground text-sm border-b border-border pb-2 flex items-center justify-between">
          <span>Materiales en el traspaso</span>
          <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground font-normal">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </h2>

        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No has agregado materiales aún.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item) => (
              <div key={item.material_id} className="py-2.5 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {item.nombre_base} {item.variante ? `(${item.variante})` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cantidad: <strong className="text-foreground font-bold">{item.cantidad} {item.unidad_medida}</strong> (de {item.disponible} disponibles)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleEliminarItem(item.material_id)}
                  className="text-xs text-danger hover:underline p-1.5"
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
