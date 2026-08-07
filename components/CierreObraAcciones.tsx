'use client'

import { useState, useTransition } from 'react'
import { cerrarObraAction, reabrirObraAction } from '@/lib/actions/cierre'

export function CierreObraAcciones({
  obraId,
  estado,
  puedeCerrar,
  puedeReabrir,
}: {
  obraId: string
  estado: string
  puedeCerrar: boolean
  puedeReabrir: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [mostrandoConfirmacion, setMostrandoConfirmacion] = useState(false)
  const [nota, setNota] = useState('')

  const handleCerrar = () => {
    setErrorMsg(null)
    startTransition(async () => {
      const res = await cerrarObraAction(obraId, nota)
      if (res.error) setErrorMsg(res.error)
      else setMostrandoConfirmacion(false)
    })
  }

  const handleReabrir = () => {
    if (!confirm('¿Estás seguro de reabrir este proyecto?')) return
    setErrorMsg(null)
    startTransition(async () => {
      const res = await reabrirObraAction(obraId)
      if (res.error) setErrorMsg(res.error)
    })
  }

  return (
    <div className="space-y-2">
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs">
          {errorMsg}
        </div>
      )}

      {estado !== 'cerrada' && puedeCerrar && !mostrandoConfirmacion && (
        <button
          onClick={() => setMostrandoConfirmacion(true)}
          className="bg-gray-800 hover:bg-black text-white font-semibold text-xs py-2 px-3 rounded-lg transition"
        >
          🔒 Cerrar Proyecto
        </button>
      )}

      {estado === 'cerrada' && puedeReabrir && (
        <button
          onClick={handleReabrir}
          disabled={isPending}
          className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs py-2 px-3 rounded-lg transition disabled:opacity-50"
        >
          {isPending ? 'Reabriendo...' : '🔓 Reabrir Proyecto'}
        </button>
      )}

      {mostrandoConfirmacion && (
        <div className="bg-gray-900 text-white p-4 rounded-xl space-y-3 shadow-lg">
          <h3 className="font-bold text-sm">¿Confirmar Cierre de Proyecto?</h3>
          <p className="text-xs text-gray-300">
            Al cerrar el proyecto no se podrán crear nuevas requisiciones ni traspasos.
          </p>

          <div>
            <label className="block text-[11px] font-semibold text-gray-300 mb-1">
              Nota o motivo de cierre (Opcional)
            </label>
            <input
              type="text"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej. Entregado a cliente y conciliación final aprobada"
              className="w-full text-xs border border-gray-700 bg-gray-800 text-white rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCerrar}
              disabled={isPending}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 px-3 rounded-lg transition disabled:opacity-50"
            >
              {isPending ? 'Cerrando...' : 'Sí, Cerrar Proyecto'}
            </button>
            <button
              onClick={() => setMostrandoConfirmacion(false)}
              className="bg-gray-700 text-gray-200 text-xs font-semibold py-2 px-3 rounded-lg hover:bg-gray-600 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
