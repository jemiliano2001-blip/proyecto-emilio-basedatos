'use client'

import { useMemo, useState } from 'react'
import { useFormState } from 'react-dom'
import type { ActionResult } from '@/lib/actions/obras'
import { FormError } from '@/components/FormError'
import { SubmitButton } from '@/components/SubmitButton'
import type { Obra } from '@/lib/types'

const initialState: ActionResult = { error: null }

interface MaterialOption {
  id: string
  nombre_base: string
  variante: string | null
  unidad_medida: string
}

interface TopeRow {
  key: string
  material_id: string
  cantidad: string
}

export function ObraForm({
  action,
  obra,
  submitLabel,
  materiales = [],
  allowTopesOnCreate = false,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>
  obra?: Pick<
    Obra,
    | 'nombre'
    | 'cliente'
    | 'fraccionamiento'
    | 'paquete'
    | 'ubicacion'
    | 'estado'
    | 'presupuesto_mxn'
  >
  submitLabel: string
  materiales?: MaterialOption[]
  allowTopesOnCreate?: boolean
}) {
  const [state, formAction] = useFormState(action, initialState)
  const [topes, setTopes] = useState<TopeRow[]>([])

  const topesJson = useMemo(
    () =>
      JSON.stringify(
        topes
          .filter((t) => t.material_id && t.cantidad.trim() !== '')
          .map((t) => ({
            material_id: t.material_id,
            cantidad_contratada: t.cantidad,
          }))
      ),
    [topes]
  )

  function agregarTope() {
    setTopes((prev) => [
      ...prev,
      { key: crypto.randomUUID(), material_id: '', cantidad: '' },
    ])
  }

  function actualizarTope(key: string, cambios: Partial<TopeRow>) {
    setTopes((prev) => prev.map((t) => (t.key === key ? { ...t, ...cambios } : t)))
  }

  function quitarTope(key: string) {
    setTopes((prev) => prev.filter((t) => t.key !== key))
  }

  function materialesDisponibles(key: string) {
    const usados = new Set(
      topes.filter((t) => t.key !== key && t.material_id).map((t) => t.material_id)
    )
    return materiales.filter((m) => !usados.has(m.id))
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="topes_json" value={allowTopesOnCreate ? topesJson : '[]'} />
      <FormError message={state.error} />
      <div>
        <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">
          Nombre del proyecto
        </label>
        <input
          id="nombre"
          name="nombre"
          required
          defaultValue={obra?.nombre ?? ''}
          className="input-base"
          placeholder="Proyecto de ejemplo"
        />
      </div>
      <div>
        <label htmlFor="cliente" className="block text-sm font-medium text-gray-700 mb-1">
          Cliente
        </label>
        <input
          id="cliente"
          name="cliente"
          defaultValue={obra?.cliente ?? ''}
          className="input-base"
          placeholder="Nombre del cliente"
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
        <p className="text-xs text-gray-400 mt-1">
          Identificador interno del paquete/lote — confirmar definición con Emilio
        </p>
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
        <label
          htmlFor="presupuesto_mxn"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Presupuesto (MXN)
        </label>
        <input
          id="presupuesto_mxn"
          name="presupuesto_mxn"
          inputMode="decimal"
          defaultValue={
            obra?.presupuesto_mxn !== undefined && obra.presupuesto_mxn !== null
              ? String(obra.presupuesto_mxn)
              : '0'
          }
          className="input-base"
          placeholder="0.00"
        />
      </div>
      <div>
        <label htmlFor="estado" className="block text-sm font-medium text-gray-700 mb-1">
          Estatus
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

      {allowTopesOnCreate && (
        <div className="space-y-3 pt-2 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Presupuesto de materiales
            </h2>
            <button
              type="button"
              onClick={agregarTope}
              className="text-sm font-semibold text-[#1E7F7A]"
              disabled={materiales.length === 0}
            >
              + Agregar
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Opcional. Define cantidades contratadas al crear el proyecto.
          </p>
          {topes.map((tope, index) => (
            <div key={tope.key} className="card space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400">
                  Material {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => quitarTope(tope.key)}
                  className="text-sm text-red-600 font-medium"
                >
                  Quitar
                </button>
              </div>
              <select
                value={tope.material_id}
                onChange={(e) => actualizarTope(tope.key, { material_id: e.target.value })}
                className="input-base"
              >
                <option value="">Selecciona un material</option>
                {materialesDisponibles(tope.key).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre_base}
                    {m.variante ? ` · ${m.variante}` : ''} ({m.unidad_medida})
                  </option>
                ))}
              </select>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Cantidad contratada"
                value={tope.cantidad}
                onChange={(e) => actualizarTope(tope.key, { cantidad: e.target.value })}
                className="input-base"
              />
            </div>
          ))}
        </div>
      )}

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  )
}
