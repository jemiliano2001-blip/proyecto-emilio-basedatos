import React from 'react'
import {
  evaluarEstatusEntrega,
  type EstadoLeadTime,
  type EvaluacionEntrega,
} from '@/lib/lead-time'
import { cn } from '@/lib/utils'

interface LeadTimeBadgeProps {
  fechaEmision: string | Date
  fechaEntregaEstimada?: string | Date | null
  fechaRecepcionReal?: string | Date | null
  categoriaOTexto?: string | null
  className?: string
}

const ESTILOS_POR_ESTADO: Record<
  EstadoLeadTime,
  { contenedor: string; punto: string }
> = {
  a_tiempo: {
    contenedor: 'bg-emerald-500/10 text-emerald-800 border-emerald-500/20 dark:text-emerald-300',
    punto: 'bg-emerald-500',
  },
  proximo_a_vencer: {
    contenedor: 'bg-amber-500/10 text-amber-800 border-amber-500/20 dark:text-amber-300',
    punto: 'bg-amber-500 animate-pulse',
  },
  retrasado: {
    contenedor: 'bg-rose-500/10 text-rose-800 border-rose-500/20 dark:text-rose-300',
    punto: 'bg-rose-500 animate-ping',
  },
  entregado: {
    contenedor: 'bg-teal-500/10 text-teal-800 border-teal-500/20 dark:text-teal-300',
    punto: 'bg-teal-500',
  },
}

export function LeadTimeBadge({
  fechaEmision,
  fechaEntregaEstimada,
  fechaRecepcionReal,
  categoriaOTexto,
  className,
}: LeadTimeBadgeProps) {
  const evaluacion: EvaluacionEntrega = React.useMemo(() => {
    return evaluarEstatusEntrega({
      fechaEmision,
      fechaEntregaEstimada,
      fechaRecepcionReal,
      categoriaOTexto,
    })
  }, [fechaEmision, fechaEntregaEstimada, fechaRecepcionReal, categoriaOTexto])

  const estilo = ESTILOS_POR_ESTADO[evaluacion.estado]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
        estilo.contenedor,
        className
      )}
      title={evaluacion.textoDescriptivo}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', estilo.punto)} aria-hidden="true" />
      <span>{evaluacion.textoDescriptivo}</span>
    </span>
  )
}
