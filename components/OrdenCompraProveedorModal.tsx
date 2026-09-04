'use client'

import React, { useState, useTransition } from 'react'
import { asignarProveedorOrdenAction } from '@/lib/actions/ordenes'

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
        className="text-xs font-semibold text-[#1E7F7A] hover:underline flex items-center gap-1"
      >
        ✏️ {proveedorActualId ? 'Cambiar proveedor / folio' : 'Asignar proveedor'}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-gray-100">
            <h3 className="text-lg font-bold text-[#132A45] mb-1">
              Proveedor y Folio Físico
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Asigna el proveedor que surtirá esta orden y opcionalmente el número de folio de la hoja membretada.
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleGuardar} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Proveedor
                </label>
                <select
                  value={proveedorId}
                  onChange={(e) => setProveedorId(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#1E7F7A]"
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
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Folio físico / No. de talonario (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej. 14329"
                  value={folioFisico}
                  onChange={(e) => setFolioFisico(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1E7F7A]"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Si dejas este campo vacío, en el formato se mostrará el folio automático del sistema.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#1E7F7A] hover:bg-[#16605d] transition-colors disabled:opacity-50"
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
