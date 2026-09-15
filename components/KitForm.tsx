'use client'

import { useActionState, useMemo, useState } from 'react'
import Link from 'next/link'
import type { ActionResult } from '@/lib/actions/kits'
import { FormError } from '@/components/FormError'
import { SubmitButton } from '@/components/SubmitButton'
import { IconPlus, IconBasura } from '@/components/icons'
import type { CatalogoMaterial } from '@/lib/types'

const initialState: ActionResult = { error: null }

interface KitItemRow {
  key: string
  material_id: string
  cantidad: string
}

export interface KitInitialData {
  id?: string
  nombre?: string
  material_principal_id?: string | null
  configuracion?: string | null
  descripcion?: string | null
  activo?: boolean
  items?: Array<{ material_id: string; cantidad: number | string }>
}

export function KitForm({
  action,
  materiales,
  kit,
  submitLabel = 'Guardar Kit',
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>
  materiales: CatalogoMaterial[]
  kit?: KitInitialData
  submitLabel?: string
}) {
  const [state, formAction] = useActionState(action, initialState)
  const [items, setItems] = useState<KitItemRow[]>(() => {
    if (kit?.items && kit.items.length > 0) {
      return kit.items.map((it) => ({
        key: crypto.randomUUID(),
        material_id: it.material_id,
        cantidad: String(it.cantidad),
      }))
    }
    return [{ key: crypto.randomUUID(), material_id: '', cantidad: '1' }]
  })

  function agregarFila() {
    setItems((prev) => [
      ...prev,
      { key: crypto.randomUUID(), material_id: '', cantidad: '1' },
    ])
  }

  function actualizarFila(key: string, cambios: Partial<KitItemRow>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...cambios } : it)))
  }

  function quitarFila(key: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.key !== key) : prev))
  }

  const itemsJson = useMemo(
    () =>
      JSON.stringify(
        items
          .filter((it) => it.material_id && it.cantidad.trim() !== '')
          .map((it) => ({
            material_id: it.material_id,
            cantidad: it.cantidad,
          }))
      ),
    [items]
  )

  const selectedMaterialIds = useMemo(
    () => new Set(items.map((item) => item.material_id).filter(Boolean)),
    [items]
  )
  const hasDuplicateMaterial = selectedMaterialIds.size !== items.filter((item) => item.material_id).length

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="items_json" value={itemsJson} />
      <FormError message={state.error} />

      <div className="card space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
          Datos de la Plantilla / Kit
        </h2>

        <div>
          <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">
            Nombre de la plantilla *
          </label>
          <input
            id="nombre"
            name="nombre"
            required
            defaultValue={kit?.nombre ?? ''}
            className="input-base"
            placeholder="ej. Kit Transformador 100 kVA - De Remate"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="material_principal_id" className="block text-sm font-medium text-gray-700 mb-1">
              Equipo principal asociado (Opcional)
            </label>
            <select
              id="material_principal_id"
              name="material_principal_id"
              defaultValue={kit?.material_principal_id ?? ''}
              className="input-base"
            >
              <option value="">-- Ninguno o genérico --</option>
              {materiales.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre_base} {m.variante ? `· ${m.variante}` : ''} ({m.unidad_medida})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Al elegir este material en una obra, se sugerirá este kit automáticamente.
            </p>
          </div>

          <div>
            <label htmlFor="configuracion" className="block text-sm font-medium text-gray-700 mb-1">
              Configuración / Tipo
            </label>
            <input
              id="configuracion"
              name="configuracion"
              defaultValue={kit?.configuracion ?? ''}
              className="input-base"
              placeholder="ej. De remate, De paso, Aéreo, Subterráneo"
            />
          </div>
        </div>

        <div>
          <label htmlFor="descripcion" className="block text-sm font-medium text-gray-700 mb-1">
            Descripción o notas de ensamble
          </label>
          <textarea
            id="descripcion"
            name="descripcion"
            rows={2}
            defaultValue={kit?.descripcion ?? ''}
            className="input-base"
            placeholder="Detalles sobre cuándo aplica este ensamble o normas técnicas..."
          />
        </div>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-ink uppercase tracking-wide">
              Componentes Menores Incluidos (&quot;Chiquitiaje&quot;)
            </h2>
            <p className="text-xs text-gray-500">
              Materiales que se inyectarán por cada unidad de kit que se cargue a la obra.
            </p>
          </div>
          <button
            type="button"
            onClick={agregarFila}
            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            <IconPlus className="w-3.5 h-3.5" />
            <span>Componente</span>
          </button>
        </div>

        <div className="space-y-3">
          {hasDuplicateMaterial && (
            <p role="alert" className="text-sm font-medium text-danger">
              Cada componente sólo puede agregarse una vez. Ajusta la cantidad en el mismo renglón.
            </p>
          )}
          {items.map((it) => (
            <div
              key={it.key}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 rounded-lg bg-gray-50 border border-gray-200"
            >
              <div className="flex-1 min-w-0">
                <select
                  value={it.material_id}
                  onChange={(e) => actualizarFila(it.key, { material_id: e.target.value })}
                  className="input-base text-sm bg-white"
                  required
                >
                  <option value="">-- Selecciona material accesorio --</option>
                  {materiales.map((m) => (
                    <option key={m.id} value={m.id} disabled={m.id !== it.material_id && selectedMaterialIds.has(m.id)}>
                      {m.nombre_base} {m.variante ? `· ${m.variante}` : ''} ({m.unidad_medida})
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full sm:w-36">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Cant. por kit"
                  value={it.cantidad}
                  onChange={(e) => actualizarFila(it.key, { cantidad: e.target.value })}
                  className="input-base text-sm bg-white text-center font-medium"
                  required
                />
              </div>

              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => quitarFila(it.key)}
                  aria-label="Quitar componente"
                  className="btn-ghost text-red-600 hover:text-red-800 p-2 self-center"
                >
                  <IconBasura className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
          <SubmitButton disabled={hasDuplicateMaterial}>{submitLabel}</SubmitButton>
        <Link href="/kits" className="btn-secondary">
          Cancelar
        </Link>
      </div>
    </form>
  )
}
