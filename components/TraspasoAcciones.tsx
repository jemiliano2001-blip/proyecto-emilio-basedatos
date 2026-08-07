'use client'

import { useState, useTransition } from 'react'
import {
  aprobarTraspasoAction,
  cancelarTraspasoAction,
  confirmarRecepcionTraspasoAction,
  rechazarTraspasoAction,
} from '@/lib/actions/traspasos'

export function TraspasoAcciones({
  traspasoId,
  estado,
  esSolicitante,
  puedeAprobar,
  puedeConfirmar,
  puedeCancelar,
}: {
  traspasoId: string
  estado: string
  esSolicitante: boolean
  puedeAprobar: boolean
  puedeConfirmar: boolean
  /** Solo el lado "admin" (proyectos / acceso_total). Al solicitante lo cubre esSolicitante. */
  puedeCancelar: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [mostrandoRechazo, setMostrandoRechazo] = useState(false)
  const [motivoRechazo, setMotivoRechazo] = useState('')

  const handleAprobar = () => {
    setErrorMsg(null)
    startTransition(async () => {
      const res = await aprobarTraspasoAction(traspasoId)
      if (res.error) setErrorMsg(res.error)
    })
  }

  const handleConfirmarRecepcion = () => {
    setErrorMsg(null)
    startTransition(async () => {
      const res = await confirmarRecepcionTraspasoAction(traspasoId)
      if (res.error) setErrorMsg(res.error)
    })
  }

  const handleRechazar = () => {
    if (!motivoRechazo.trim()) {
      setErrorMsg('Ingresa un motivo de rechazo.')
      return
    }
    setErrorMsg(null)
    startTransition(async () => {
      const res = await rechazarTraspasoAction(traspasoId, motivoRechazo)
      if (res.error) setErrorMsg(res.error)
      else setMostrandoRechazo(false)
    })
  }

  const handleCancelar = () => {
    if (!confirm('¿Estás seguro de cancelar este traspaso?')) return
    setErrorMsg(null)
    startTransition(async () => {
      const res = await cancelarTraspasoAction(traspasoId)
      if (res.error) setErrorMsg(res.error)
    })
  }

  return (
    <div className="space-y-3">
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
          {errorMsg}
        </div>
      )}

      {estado === 'solicitado' && (
        <div className="flex flex-wrap gap-2">
          {puedeAprobar && (
            <button
              onClick={handleAprobar}
              disabled={isPending}
              className="bg-green-700 hover:bg-green-800 text-white font-bold py-2.5 px-4 rounded-lg shadow-sm transition text-sm disabled:opacity-50"
            >
              {isPending ? 'Aprobando...' : '✓ Aprobar Traspaso (En tránsito)'}
            </button>
          )}

          {puedeAprobar && !mostrandoRechazo && (
            <button
              onClick={() => setMostrandoRechazo(true)}
              disabled={isPending}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-lg transition text-sm disabled:opacity-50"
            >
              ✕ Rechazar
            </button>
          )}

          {/* `cancelar_traspaso` acepta al solicitante o a proyectos/acceso_total.
              Antes esto usaba puedeAprobar, así que a compras y operación les
              aparecía el botón y les tronaba la RPC. */}
          {(esSolicitante || puedeCancelar) && (
            <button
              onClick={handleCancelar}
              disabled={isPending}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2.5 px-4 rounded-lg transition text-sm disabled:opacity-50"
            >
              Cancelar
            </button>
          )}
        </div>
      )}

      {estado === 'en_transito' && (
        <div className="flex flex-wrap gap-2">
          {puedeConfirmar && (
            <button
              onClick={handleConfirmarRecepcion}
              disabled={isPending}
              className="bg-blue-700 hover:bg-blue-800 text-white font-bold py-2.5 px-4 rounded-lg shadow-md transition text-sm disabled:opacity-50"
            >
              {isPending ? 'Confirmando...' : '📦 Confirmar Recepción (Completar)'}
            </button>
          )}

          {puedeAprobar && !mostrandoRechazo && (
            <button
              onClick={() => setMostrandoRechazo(true)}
              disabled={isPending}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-lg transition text-sm disabled:opacity-50"
            >
              ✕ Rechazar Traspaso
            </button>
          )}
        </div>
      )}

      {mostrandoRechazo && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl space-y-3">
          <label className="block text-xs font-semibold text-red-800">
            Motivo del rechazo
          </label>
          <input
            type="text"
            value={motivoRechazo}
            onChange={(e) => setMotivoRechazo(e.target.value)}
            placeholder="Especifica la razón por la que se rechaza"
            className="w-full text-sm border border-red-300 rounded-lg p-2 focus:ring-2 focus:ring-red-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleRechazar}
              disabled={isPending}
              className="bg-red-700 text-white text-xs font-bold py-2 px-3 rounded-lg"
            >
              {isPending ? 'Rechazando...' : 'Confirmar Rechazo'}
            </button>
            <button
              onClick={() => setMostrandoRechazo(false)}
              className="bg-gray-200 text-gray-700 text-xs font-semibold py-2 px-3 rounded-lg"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
