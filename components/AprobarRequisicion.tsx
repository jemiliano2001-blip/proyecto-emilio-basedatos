'use client'

import { useActionState } from 'react'
import {
  aprobarPagoSolicitudAction,
  aprobarSolicitudComprasAction,
  rechazarSolicitudAction,
  type ActionResult,
} from '@/lib/actions/solicitudes'
import { FormError } from '@/components/FormError'
import { SubmitButton } from '@/components/SubmitButton'
import { formatMoneyMx } from '@/lib/money'

const initialState: ActionResult = { error: null }

export type MaterialPrecioRow = {
  id: string
  nombre: string
  cantidad: number
  unidad: string
  precioBase: number | null
  /** Precio unitario ya guardado (monto/cantidad), si existe */
  precioUnitarioActual: number | null
}

export function AprobarComprasButton({
  solicitudId,
  materiales,
}: {
  solicitudId: string
  materiales: MaterialPrecioRow[]
}) {
  const action = aprobarSolicitudComprasAction.bind(null, solicitudId)
  const [state, formAction] = useActionState(action, initialState)

  return (
    <form action={formAction} className="space-y-3">
      {materiales.length > 0 && (
        <div className="card space-y-3 p-3 border-teal-200 bg-teal-50/30">
          <p className="text-sm font-semibold text-ink">
            Precio cotizado por material
          </p>
          <p className="text-xs text-gray-500">
            Captura el precio real unitario. Se muestra el precio base de referencia del
            catálogo.
          </p>
          {materiales.map((m) => (
            <div key={m.id} className="space-y-1.5 border-t border-teal-100 pt-2 first:border-0 first:pt-0">
              <div className="flex justify-between gap-2 text-sm">
                <span className="font-medium text-ink">{m.nombre}</span>
                <span className="text-gray-500 shrink-0 tabular-nums">
                  {m.cantidad} {m.unidad}
                </span>
              </div>
              {m.precioBase != null && m.precioBase > 0 && (
                <p className="text-xs text-gray-500">
                  Precio base ref.: {formatMoneyMx(m.precioBase)} / {m.unidad}
                </p>
              )}
              <label className="block text-xs font-semibold text-gray-600">
                Precio cotizado (MXN / {m.unidad}) *
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
                  className="input-base mt-1"
                  placeholder="0.00"
                />
              </label>
            </div>
          ))}
        </div>
      )}
      <FormError message={state.error} />
      <SubmitButton>Aprobar (Compras)</SubmitButton>
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
