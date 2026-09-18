'use client'

import { useActionState, useMemo, useState } from 'react'
import { createCotizacionAction, type ActionResult } from '@/lib/actions/cotizaciones'
import { AprobarRechazarCotizacion } from '@/components/AprobarRechazarCotizacion'
import { FormError } from '@/components/FormError'
import { SubmitButton } from '@/components/SubmitButton'

const initialState: ActionResult = { error: null }

interface SolicitudItemRow {
  id: string
  cantidad_solicitada: number
  material: {
    nombre_base: string
    variante: string | null
    unidad_medida: string
  } | null
}

interface ProveedorOption {
  id: string
  nombre: string
}

interface CotizacionExistente {
  id: string
  estado: string
  items: {
    id: string
    solicitud_item_id: string
    proveedor_id: string
    precio_unitario: number
    cantidad: number
    moneda: string
  }[]
}

export function CotizarForm({
  solicitudId,
  items,
  proveedores,
  cotizacionExistente,
}: {
  solicitudId: string
  items: SolicitudItemRow[]
  proveedores: ProveedorOption[]
  cotizacionExistente: CotizacionExistente | null
}) {
  const [state, formAction] = useActionState(createCotizacionAction, initialState)
  const [proveedorId, setProveedorId] = useState(proveedores[0]?.id ?? '')
  const [moneda, setMoneda] = useState<'MXN' | 'USD'>('MXN')
  const [precios, setPrecios] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const item of items) {
      initial[item.id] = ''
    }
    return initial
  })

  const itemsJson = useMemo(() => {
    return JSON.stringify(
      items.map((item) => ({
        solicitud_item_id: item.id,
        proveedor_id: proveedorId,
        precio_unitario: precios[item.id] ?? '',
        cantidad: item.cantidad_solicitada,
        moneda,
      }))
    )
  }, [items, proveedorId, precios, moneda])

  if (proveedores.length === 0) {
    return (
      <div className="card border-warning/40 bg-warning-soft text-warning-soft-foreground">
        Primero crea un proveedor en la sección de Proveedores.
      </div>
    )
  }

  if (cotizacionExistente) {
    return (
      <div className="space-y-4">
        <div className="card">
          <p className="text-sm text-muted-foreground mb-2">
            Cotización:{' '}
            <span className="font-semibold capitalize text-foreground">
              {cotizacionExistente.estado}
            </span>
          </p>
          <div className="space-y-2">
            {cotizacionExistente.items.map((ci) => {
              const si = items.find((i) => i.id === ci.solicitud_item_id)
              const subtotal = Number(ci.precio_unitario) * Number(ci.cantidad)
              return (
                <div key={ci.id} className="flex justify-between text-sm gap-2">
                  <span>
                    {si?.material?.nombre_base}
                    {si?.material?.variante ? ` · ${si.material.variante}` : ''}
                  </span>
                  <span className="shrink-0 font-medium">
                    {ci.cantidad} × {ci.precio_unitario} {ci.moneda} = {subtotal.toFixed(2)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {(cotizacionExistente.estado === 'borrador' ||
          cotizacionExistente.estado === 'enviada') && (
          <AprobarRechazarCotizacion cotizacionId={cotizacionExistente.id} />
        )}

        {cotizacionExistente.estado === 'aprobada' && (
          <p className="text-sm text-success-soft-foreground text-center">
            Cotización aprobada. Revisa la orden en Órdenes.
          </p>
        )}
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="solicitud_id" value={solicitudId} />
      <input type="hidden" name="items_json" value={itemsJson} />
      <FormError message={state.error} />

      <div>
        <label htmlFor="proveedor_id" className="block text-sm font-medium text-foreground mb-1">
          Proveedor
        </label>
        <select
          id="proveedor_id"
          className="input-base"
          value={proveedorId}
          onChange={(e) => setProveedorId(e.target.value)}
        >
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="moneda" className="block text-sm font-medium text-foreground mb-1">
          Moneda
        </label>
        <select
          id="moneda"
          className="input-base"
          value={moneda}
          onChange={(e) => setMoneda(e.target.value as 'MXN' | 'USD')}
        >
          <option value="MXN">MXN</option>
          <option value="USD">USD</option>
        </select>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="card">
            <p className="font-medium text-sm">
              {item.material?.nombre_base}
              {item.material?.variante ? ` · ${item.material.variante}` : ''}
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              Cantidad: {item.cantidad_solicitada} {item.material?.unidad_medida}
            </p>
            <label className="block text-sm font-medium text-foreground mb-1">
              Precio unitario ({moneda})
              <input
                type="text"
                inputMode="decimal"
                required
                className="input-base mt-1"
                value={precios[item.id] ?? ''}
                onChange={(e) =>
                  setPrecios((prev) => ({ ...prev, [item.id]: e.target.value }))
                }
                placeholder="0.00"
              />
            </label>
          </div>
        ))}
      </div>

      <div>
        <label htmlFor="nota" className="block text-sm font-medium text-foreground mb-1">
          Nota (opcional)
        </label>
        <textarea id="nota" name="nota" rows={2} className="input-base" />
      </div>

      <SubmitButton>Guardar cotización</SubmitButton>
    </form>
  )
}
