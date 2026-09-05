'use client'

import React, { useState, useTransition } from 'react'
import { asignarProveedorOrdenAction } from '@/lib/actions/ordenes'
import { IconEditar } from '@/components/icons'

interface ProveedorOption {
  id: string
  nombre: string
}

interface Props {
  ordenId: string
  proveedorActualId: string | null
  folioFisicoActual?: string | null
  proveedores: ProveedorOption[]
}

export function OrdenCompraProveedorModal({
  ordenId,
  proveedorActualId,
  folioFisicoActual,
  proveedores,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [proveedorId, setProveedorId] = useState(proveedorActualId || '')
  const [folioFisico, setFolioFisico] = useState(folioFisicoActual || '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleGuardar = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const res = await asignarProveedorOrdenAction(
        ordenId,
        proveedorId || null,
        folioFisico || null
      )
      if (res.error) {
        setError(res.error)
      } else {
        setIsOpen(false)
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-xs font-semibold text-accent hover:underline inline-flex items-center gap-1"
      >
        <IconEditar className="w-3.5 h-3.5" />
        <span>{proveedorActualId ? 'Cambiar proveedor / folio' : 'Asignar proveedor'}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs">
          <div className="card w-full max-w-md shadow-xl border border-rule">
            <h3 className="text-lg font-bold text-ink mb-1">
              Proveedor y Folio Físico
            </h3>
            <p className="text-xs text-muted mb-4">
              Asigna el proveedor que surtirá esta orden y opcionalmente el número de folio de la hoja membretada.
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleGuardar} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Proveedor
                </label>
                <select
                  value={proveedorId}
                  onChange={(e) => setProveedorId(e.target.value)}
                  className="input-base"
                >
                  <option value="">-- Sin proveedor seleccionado --</option>
                  {proveedores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Folio físico / No. de talonario (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej. 14329"
                  value={folioFisico}
                  onChange={(e) => setFolioFisico(e.target.value)}
                  className="input-base"
                />
                <p className="text-[11px] text-muted mt-1">
                  Si dejas este campo vacío, en el formato se mostrará el folio automático del sistema.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={isPending}
                  className="btn-secondary text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="btn-primary text-xs"
                >
                  {isPending ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
