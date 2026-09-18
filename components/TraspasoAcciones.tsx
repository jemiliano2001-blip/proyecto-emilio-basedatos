'use client'

import { useState, useTransition } from 'react'
import {
  aprobarTraspasoAction,
  cancelarTraspasoAction,
  confirmarRecepcionTraspasoAction,
  rechazarTraspasoAction,
} from '@/lib/actions/traspasos'
import { IconCheck, IconPaquete } from '@/components/icons'

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
        <div className="bg-danger-soft border border-danger/30 text-danger-soft-foreground p-3 rounded-lg text-sm" role="alert">
          {errorMsg}
        </div>
      )}

      {estado === 'solicitado' && (
        <div className="flex flex-wrap gap-2">
          {puedeAprobar && (
            <button
              onClick={handleAprobar}
              disabled={isPending}
              aria-busy={isPending}
              className="btn-primary btn-sm"
            >
              <IconCheck className="h-4 w-4" />
              <span>{isPending ? 'Aprobando…' : 'Aprobar traspaso'}</span>
            </button>
          )}

          {puedeAprobar && !mostrandoRechazo && (
            <button
              onClick={() => setMostrandoRechazo(true)}
              disabled={isPending}
              className="btn-danger btn-sm"
            >
              Rechazar
            </button>
          )}

          {(esSolicitante || puedeCancelar) && (
            <button
              onClick={handleCancelar}
              disabled={isPending}
              className="btn-secondary btn-sm"
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
              aria-busy={isPending}
              className="btn-primary btn-sm"
            >
              <IconPaquete className="h-4 w-4" />
              <span>{isPending ? 'Confirmando…' : 'Confirmar recepción (completar)'}</span>
            </button>
          )}

          {puedeAprobar && !mostrandoRechazo && (
            <button
              onClick={() => setMostrandoRechazo(true)}
              disabled={isPending}
              className="btn-danger btn-sm"
            >
              Rechazar traspaso
            </button>
          )}
        </div>
      )}

      {mostrandoRechazo && (
        <div className="card border-danger/30 bg-danger-soft/50 p-4 space-y-3">
          <label className="block text-xs font-semibold text-danger-soft-foreground">
            Motivo del rechazo
          </label>
          <input
            type="text"
            value={motivoRechazo}
            onChange={(e) => setMotivoRechazo(e.target.value)}
            placeholder="Especifica la razón por la que se rechaza"
            className="input-base text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={handleRechazar}
              disabled={isPending}
              className="btn-danger btn-xs"
            >
              {isPending ? 'Rechazando…' : 'Confirmar rechazo'}
            </button>
            <button
              onClick={() => setMostrandoRechazo(false)}
              className="btn-secondary btn-xs"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
