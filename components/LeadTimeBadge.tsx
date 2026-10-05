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
    contenedor: 'bg-success-soft text-success-soft-foreground border-success/30',
    punto: 'bg-success',
  },
  proximo_a_vencer: {
    contenedor: 'bg-warning-soft text-warning-soft-foreground border-warning/30',
    punto: 'bg-warning animate-pulse',
  },
  retrasado: {
    contenedor: 'bg-danger-soft text-danger-soft-foreground border-danger/30',
    punto: 'bg-danger animate-pulse',
  },
  entregado: {
    contenedor: 'bg-primary-soft text-primary-soft-foreground border-primary/30',
    punto: 'bg-primary',
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
