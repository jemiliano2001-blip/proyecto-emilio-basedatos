'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import type { ActionResult } from '@/lib/actions/materiales'
import { FormError } from '@/components/FormError'
import { SubmitButton } from '@/components/SubmitButton'
import { PhotoUploadInput } from '@/components/PhotoUploadInput'
import type { CatalogoMaterial, MaterialCategoria } from '@/lib/types'

const initialState: ActionResult = { error: null }

export function MaterialForm({
  action,
  material,
  submitLabel,
  categorias = [],
  initialCategoria,
  initialSubcategoria,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>
  material?: CatalogoMaterial
  submitLabel: string
  categorias?: MaterialCategoria[]
  initialCategoria?: string
  initialSubcategoria?: string
}) {
  const [state, formAction] = useActionState(action, initialState)
  const [categoria, setCategoria] = useState(material?.categoria ?? initialCategoria ?? '')
  const [subcategoria, setSubcategoria] = useState(material?.subcategoria ?? initialSubcategoria ?? '')

  // Subcategorías de la categoría seleccionada
  const catActual = categorias.find((c) => c.nombre === categoria)
  const subcats = catActual?.material_subcategorias?.map((s) => s.nombre) ?? []

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.error} />
      <div>
        <label htmlFor="nombre_base" className="block text-sm font-medium text-foreground mb-1">
          Nombre base *
        </label>
        <input
          id="nombre_base"
          name="nombre_base"
          required
          defaultValue={material?.nombre_base ?? ''}
          className="input-base"
          placeholder="ej. Tubo Conduit PAD 2 pulgadas"
        />
      </div>
      <div>
        <label htmlFor="variante" className="block text-sm font-medium text-foreground mb-1">
          Variante
        </label>
        <input
          id="variante"
          name="variante"
          defaultValue={material?.variante ?? ''}
          className="input-base"
          placeholder="Opcional (ej. RD 13.5, 75 kVA, Calibre 1/0)"
        />
      </div>
      <div>
        <label htmlFor="unidad_medida" className="block text-sm font-medium text-foreground mb-1">
          Unidad de medida *
        </label>
        <input
          id="unidad_medida"
          name="unidad_medida"
          required
          defaultValue={material?.unidad_medida ?? ''}
          className="input-base"
          placeholder="PZA, MTS, KG, LOTE…"
        />
      </div>
      <div>
        <label htmlFor="categoria" className="block text-sm font-medium text-foreground mb-1">
          Categoría
        </label>
        <select
          id="categoria"
          name="categoria"
          value={categoria}
          onChange={(e) => {
            setCategoria(e.target.value)
            setSubcategoria('')
          }}
          className="input-base"
        >
          <option value="">Sin categoría</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.nombre}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="subcategoria" className="block text-sm font-medium text-foreground mb-1">
          Subcategoría
        </label>
        <select
          id="subcategoria"
          name="subcategoria"
          value={subcategoria}
          onChange={(e) => setSubcategoria(e.target.value)}
          className="input-base"
          disabled={!categoria || subcats.length === 0}
        >
          <option value="">
            {!categoria
              ? 'Elige categoría primero'
              : subcats.length === 0
                ? 'Esta categoría no tiene subcategorías'
                : 'Sin subcategoría'}
          </option>
          {subcats.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="especificacion" className="block text-sm font-medium text-foreground mb-1">
          Especificación
        </label>
        <textarea
          id="especificacion"
          name="especificacion"
          rows={3}
          defaultValue={material?.especificacion ?? ''}
          className="input-base"
          placeholder="Normas CFE, fichas técnicas o notas adicionales..."
        />
      </div>
      <div>
        <label htmlFor="precio_base" className="block text-sm font-medium text-foreground mb-1">
          Precio base de referencia (MXN)
        </label>
        <input
          id="precio_base"
          name="precio_base"
          type="number"
          step="0.01"
          min="0"
          defaultValue={material?.precio_base !== undefined ? String(material.precio_base) : '0.00'}
          className="input-base"
          placeholder="0.00"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Costo base unitario estimado utilizado para calcular el presupuesto en proyectos.
        </p>
      </div>

      {/* FOTO DEL MATERIAL (cámara, compresión y control de calidad) */}
      <PhotoUploadInput
        id="foto"
        name="foto"
        label="Foto del material"
        existingUrl={material?.foto_url}
        captureCamera
      />

      {/* CAMPO ACTIVO CON EXPLICACIÓN EN ESPAÑOL */}
      <div>
        <label htmlFor="activo" className="block text-sm font-medium text-foreground mb-1">
          Activo
        </label>
        <select
          id="activo"
          name="activo"
          defaultValue={material ? (material.activo ? 'true' : 'false') : 'true'}
          className="input-base"
        >
          <option value="true">Sí</option>
          <option value="false">No</option>
        </select>
        <p className="text-xs text-muted-foreground mt-1">
          Activo = sí aparece en el catálogo y se puede usar en obras; No = queda oculto del catálogo sin borrarlo.
        </p>
      </div>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  )
}
