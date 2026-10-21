'use client'

import { useActionState } from 'react'
import type { ActionResult } from '@/lib/actions/proveedores'
import { FormError } from '@/components/FormError'
import { SubmitButton } from '@/components/SubmitButton'
import type { Proveedor } from '@/lib/types'

const initialState: ActionResult = { error: null }

export function ProveedorForm({
  action,
  proveedor,
  submitLabel,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>
  proveedor?: Proveedor
  submitLabel: string
}) {
  const [state, formAction] = useActionState(action, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.error} />
      <div>
        <label htmlFor="nombre" className="block text-sm font-medium text-foreground mb-1">
          Nombre
        </label>
        <input
          id="nombre"
          name="nombre"
          required
          defaultValue={proveedor?.nombre ?? ''}
          className="input-base"
          placeholder="Proveedor de ejemplo"
        />
      </div>
      <div>
        <label htmlFor="contacto" className="block text-sm font-medium text-foreground mb-1">
          Contacto
        </label>
        <input
          id="contacto"
          name="contacto"
          defaultValue={proveedor?.contacto ?? ''}
          className="input-base"
        />
      </div>
      <div>
        <label htmlFor="telefono" className="block text-sm font-medium text-foreground mb-1">
          Teléfono
        </label>
        <input
          id="telefono"
          name="telefono"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          defaultValue={proveedor?.telefono ?? ''}
          className="input-base"
        />
      </div>
      <div>
        <label htmlFor="correo" className="block text-sm font-medium text-foreground mb-1">
          Correo
        </label>
        <input
          id="correo"
          name="correo"
          type="email"
          inputMode="email"
          autoComplete="off"
          defaultValue={proveedor?.correo ?? ''}
          className="input-base"
          placeholder="ventas@proveedor.com"
        />
      </div>
      <div>
        <label htmlFor="rfc" className="block text-sm font-medium text-foreground mb-1">
          RFC
        </label>
        <input
          id="rfc"
          name="rfc"
          maxLength={13}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          defaultValue={proveedor?.rfc ?? ''}
          className="input-base uppercase"
          placeholder="ABC010203XY1"
        />
      </div>
      <div>
        <label htmlFor="direccion" className="block text-sm font-medium text-foreground mb-1">
          Dirección
        </label>
        <textarea
          id="direccion"
          name="direccion"
          rows={2}
          maxLength={500}
          autoComplete="off"
          defaultValue={proveedor?.direccion ?? ''}
          className="input-base"
        />
      </div>
      <div>
        <label htmlFor="condiciones_pago" className="block text-sm font-medium text-foreground mb-1">
          Condiciones de pago
        </label>
        <input
          id="condiciones_pago"
          name="condiciones_pago"
          maxLength={200}
          autoComplete="off"
          defaultValue={proveedor?.condiciones_pago ?? ''}
          className="input-base"
          placeholder="Ej. Crédito a 30 días"
        />
      </div>
      {proveedor && (
        <div>
          <label htmlFor="activo" className="block text-sm font-medium text-foreground mb-1">
            Activo
          </label>
          <select
            id="activo"
            name="activo"
            defaultValue={proveedor.activo ? 'true' : 'false'}
            className="input-base"
          >
            <option value="true">Sí</option>
            <option value="false">No</option>
          </select>
        </div>
      )}
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  )
}
