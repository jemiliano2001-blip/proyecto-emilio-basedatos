'use client'

import { useActionState, useState, useTransition } from 'react'
import {
  aprobarPagoSolicitudAction,
  aprobarSolicitudComprasAction,
  eliminarPartidaSolicitudAction,
  rechazarSolicitudAction,
  type ActionResult,
} from '@/lib/actions/solicitudes'
import { FormError } from '@/components/FormError'
import { SubmitButton } from '@/components/SubmitButton'
import { formatMoneyMx } from '@/lib/money'
import { IconBasura } from '@/components/icons'

const initialState: ActionResult = { error: null }

export type MaterialPrecioRow = {
  id: string
  nombre: string
  cantidad: number
  unidad: string
  precioBase: number | null
  /** Precio unitario ya guardado (monto/cantidad), si existe */
  precioUnitarioActual: number | null
  proveedorId?: string | null
}

export type ProveedorOpcion = {
  id: string
  nombre: string
}

export function AprobarComprasButton({
  solicitudId,
  materiales,
  proveedores = [],
}: {
  solicitudId: string
  materiales: MaterialPrecioRow[]
  proveedores?: ProveedorOpcion[]
}) {
  const action = aprobarSolicitudComprasAction.bind(null, solicitudId)
  const [state, formAction] = useActionState(action, initialState)
  const [isPendingEliminar, startTransition] = useTransition()
  const [eliminandoId, setEliminandoId] = useState<string | null>(null)
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null)

  function handleEliminar(itemId: string, nombre: string) {
    if (!window.confirm(`¿Seguro que deseas quitar la partida "${nombre}" de esta requisición?`)) {
      return
    }
    setErrorEliminar(null)
    setEliminandoId(itemId)
    startTransition(async () => {
      const res = await eliminarPartidaSolicitudAction(solicitudId, itemId)
      setEliminandoId(null)
      if (res.error) {
        setErrorEliminar(res.error)
      }
    })
  }

  return (
    <form action={formAction} className="space-y-3">
      {materiales.length > 0 && (
        <div className="card space-y-3 p-3.5 border-primary/30 bg-primary-soft/30">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-foreground">
              Revisión de partidas y cotización (Compras)
            </p>
            <span className="text-xs text-muted-foreground">
              {materiales.length} {materiales.length === 1 ? 'partida' : 'partidas'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Ajusta cantidades si es necesario, asigna el proveedor por partida y captura el precio cotizado real.
          </p>

          <FormError message={errorEliminar} />

          <div className="space-y-3 pt-1">
            {materiales.map((m) => {
              const estaEliminando = isPendingEliminar && eliminandoId === m.id
              return (
                <div
                  key={m.id}
                  className={`rounded-xl border border-primary/20 bg-card p-3 space-y-2.5 transition-opacity ${
                    estaEliminando ? 'opacity-40 pointer-events-none' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-snug">{m.nombre}</p>
                      {m.precioBase != null && m.precioBase > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Precio catálogo ref.: {formatMoneyMx(m.precioBase)} / {m.unidad}
                        </p>
                      )}
                    </div>
                    {materiales.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => handleEliminar(m.id, m.nombre)}
                        disabled={isPendingEliminar}
                        title="Quitar partida de la requisición"
                        className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-danger hover:underline px-1 py-0.5 rounded transition-colors"
                      >
                        <IconBasura className="h-3.5 w-3.5" />
                        <span>Quitar</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground shrink-0 italic">
                        Única partida
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">
                        Cantidad ({m.unidad}) *
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        name={`cantidad_${m.id}`}
                        required
                        defaultValue={m.cantidad}
                        className="input-base text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">
                        Precio cotizado ({m.unidad}) *
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        name={`precio_unitario_${m.id}`}
                        required
                        defaultValue={
                          m.precioUnitarioActual != null && m.precioUnitarioActual > 0
                            ? String(m.precioUnitarioActual)
                            : m.precioBase != null && m.precioBase > 0
                              ? String(m.precioBase)
                              : ''
                        }
                        className="input-base text-sm"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">
                        Proveedor
                      </label>
                      <select
                        name={`proveedor_${m.id}`}
                        defaultValue={m.proveedorId ?? ''}
                        className="input-base text-sm"
                      >
                        <option value="">-- Por definir --</option>
                        {proveedores.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      <FormError message={state.error} />
      <SubmitButton>Aprobar y pasar a Finanzas</SubmitButton>
    </form>
  )
}

export function AprobarPagoButton({ solicitudId }: { solicitudId: string }) {
  const action = aprobarPagoSolicitudAction.bind(null, solicitudId)
  const [state, formAction] = useActionState(action, initialState)

  return (
    <form action={formAction} className="space-y-2">
      <FormError message={state.error} />
      <SubmitButton>Pagar y finalizar (Finanzas)</SubmitButton>
    </form>
  )
}

export function RechazarSolicitudForm({ solicitudId }: { solicitudId: string }) {
  const action = rechazarSolicitudAction.bind(null, solicitudId)
  const [state, formAction] = useActionState(action, initialState)

  return (
    <form action={formAction} className="space-y-2">
      <FormError message={state.error} />
      <input
        name="motivo"
        className="input-base"
        placeholder="Motivo del rechazo (opcional)"
      />
      <button type="submit" className="btn-danger w-full text-sm">
        Rechazar
      </button>
    </form>
  )
}
