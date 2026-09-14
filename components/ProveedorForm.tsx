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
        <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">
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
        <label htmlFor="contacto" className="block text-sm font-medium text-gray-700 mb-1">
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
        <label htmlFor="telefono" className="block text-sm font-medium text-gray-700 mb-1">
          Teléfono
        </label>
        <input
          id="telefono"
          name="telefono"
          defaultValue={proveedor?.telefono ?? ''}
          className="input-base"
        />
      </div>
      {proveedor && (
        <div>
          <label htmlFor="activo" className="block text-sm font-medium text-gray-700 mb-1">
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
