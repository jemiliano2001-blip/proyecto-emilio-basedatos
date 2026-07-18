'use client'

import { useFormState } from 'react-dom'
import type { ActionResult } from '@/lib/actions/obras'
import { FormError } from '@/components/FormError'
import { SubmitButton } from '@/components/SubmitButton'
import type { Obra } from '@/lib/types'

const initialState: ActionResult = { error: null }

export function ObraForm({
  action,
  obra,
  submitLabel,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>
  obra?: Pick<Obra, 'nombre' | 'fraccionamiento' | 'paquete' | 'ubicacion' | 'estado'>
  submitLabel: string
}) {
  const [state, formAction] = useFormState(action, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.error} />
      <div>
        <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">
          Nombre de la obra
        </label>
        <input
          id="nombre"
          name="nombre"
          required
          defaultValue={obra?.nombre ?? ''}
          className="input-base"
          placeholder="Obra de ejemplo"
        />
      </div>
      <div>
        <label htmlFor="fraccionamiento" className="block text-sm font-medium text-gray-700 mb-1">
          Fraccionamiento
        </label>
        <input
          id="fraccionamiento"
          name="fraccionamiento"
          defaultValue={obra?.fraccionamiento ?? ''}
          className="input-base"
        />
      </div>
      <div>
        <label htmlFor="paquete" className="block text-sm font-medium text-gray-700 mb-1">
          Paquete
        </label>
        <input
          id="paquete"
          name="paquete"
          defaultValue={obra?.paquete ?? ''}
          className="input-base"
        />
      </div>
      <div>
        <label htmlFor="ubicacion" className="block text-sm font-medium text-gray-700 mb-1">
          Ubicación
        </label>
        <input
          id="ubicacion"
          name="ubicacion"
          defaultValue={obra?.ubicacion ?? ''}
          className="input-base"
        />
      </div>
      <div>
        <label htmlFor="estado" className="block text-sm font-medium text-gray-700 mb-1">
          Estado
        </label>
        <select
          id="estado"
          name="estado"
          defaultValue={obra?.estado ?? 'activa'}
          className="input-base"
        >
          <option value="activa">Activa</option>
          <option value="pausada">Pausada</option>
          <option value="cerrada">Cerrada</option>
        </select>
      </div>
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  )
}
