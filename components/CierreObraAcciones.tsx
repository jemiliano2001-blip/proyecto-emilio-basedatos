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
    if (!confirm('¿Reabrir este proyecto?')) return
    setErrorMsg(null)
    startTransition(async () => {
      const res = await reabrirObraAction(obraId)
      if (res.error) setErrorMsg(res.error)
    })
  }

  return (
    <div className="space-y-2">
      {errorMsg && (
        <div className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger-soft-foreground" role="alert">
          {errorMsg}
        </div>
      )}

      {estado !== 'cerrada' && puedeCerrar && !mostrandoConfirmacion && (
        <button
          type="button"
          onClick={() => setMostrandoConfirmacion(true)}
          className="btn-danger btn-sm"
        >
          Cerrar proyecto
        </button>
      )}

      {estado === 'cerrada' && puedeReabrir && (
        <button
          type="button"
          onClick={handleReabrir}
          disabled={isPending}
          aria-busy={isPending}
          className="btn-secondary btn-sm"
        >
          {isPending ? 'Reabriendo…' : 'Reabrir proyecto'}
        </button>
      )}

      {mostrandoConfirmacion && (
        <div className="card space-y-3 border-danger/30">
          <h3 className="text-sm font-bold text-foreground">¿Cerrar este proyecto?</h3>
          <p className="text-sm text-muted-foreground">
            Al cerrar no se podrán crear nuevas requisiciones ni traspasos.
          </p>

          <div>
            <label htmlFor="cierre-nota" className="mb-1 block text-sm font-semibold text-foreground">
              Nota o motivo de cierre (opcional)
            </label>
            <input
              id="cierre-nota"
              type="text"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej. Entregado a cliente y conciliación final aprobada"
              className="input-base"
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={handleCerrar}
              disabled={isPending}
              aria-busy={isPending}
              className="btn-danger btn-sm"
            >
              {isPending ? 'Cerrando…' : 'Sí, cerrar proyecto'}
            </button>
            <button
              type="button"
              onClick={() => setMostrandoConfirmacion(false)}
              className="btn-secondary btn-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
