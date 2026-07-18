'use client'

import { useFormState } from 'react-dom'
import type { ActionResult } from '@/lib/actions/materiales'
import { FormError } from '@/components/FormError'
import { SubmitButton } from '@/components/SubmitButton'
import type { CatalogoMaterial } from '@/lib/types'

const initialState: ActionResult = { error: null }

export function MaterialForm({
  action,
  material,
  submitLabel,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>
  material?: CatalogoMaterial
  submitLabel: string
}) {
  const [state, formAction] = useFormState(action, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.error} />
      <div>
        <label htmlFor="nombre_base" className="block text-sm font-medium text-gray-700 mb-1">
          Nombre base
        </label>
        <input
          id="nombre_base"
          name="nombre_base"
          required
          defaultValue={material?.nombre_base ?? ''}
          className="input-base"
          placeholder="Material de ejemplo"
        />
      </div>
      <div>
        <label htmlFor="variante" className="block text-sm font-medium text-gray-700 mb-1">
          Variante
        </label>
        <input
          id="variante"
          name="variante"
          defaultValue={material?.variante ?? ''}
          className="input-base"
          placeholder="Opcional"
        />
      </div>
      <div>
        <label htmlFor="unidad_medida" className="block text-sm font-medium text-gray-700 mb-1">
          Unidad de medida
        </label>
        <input
          id="unidad_medida"
          name="unidad_medida"
          required
          defaultValue={material?.unidad_medida ?? ''}
          className="input-base"
          placeholder="PZA, MTS, KG…"
        />
      </div>
      <div>
        <label htmlFor="categoria" className="block text-sm font-medium text-gray-700 mb-1">
          Categoría
        </label>
        <input
          id="categoria"
          name="categoria"
          defaultValue={material?.categoria ?? ''}
          className="input-base"
        />
      </div>
      <div>
        <label htmlFor="subcategoria" className="block text-sm font-medium text-gray-700 mb-1">
          Subcategoría
        </label>
        <input
          id="subcategoria"
          name="subcategoria"
          defaultValue={material?.subcategoria ?? ''}
          className="input-base"
        />
      </div>
      <div>
        <label htmlFor="especificacion" className="block text-sm font-medium text-gray-700 mb-1">
          Especificación
        </label>
        <textarea
          id="especificacion"
          name="especificacion"
          rows={3}
          defaultValue={material?.especificacion ?? ''}
          className="input-base"
        />
      </div>
      {material && (
        <div>
          <label htmlFor="activo" className="block text-sm font-medium text-gray-700 mb-1">
            Activo
          </label>
          <select
            id="activo"
            name="activo"
            defaultValue={material.activo ? 'true' : 'false'}
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
