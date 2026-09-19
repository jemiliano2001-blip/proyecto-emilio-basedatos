/**
 * Normalizador y Predictor de Lead Times para Abastecimiento en Proyecto Emilio.
 * Basado en las métricas de compras y categorías de obra civil y electromecánico.
 */

export interface MetricasLeadTime {
  diasMin: number
  diasMax: number
  diasPromedio: number
  nivelCriticidad: 'baja' | 'media' | 'alta'
  etiquetaCategoria: string
}

export type EstadoLeadTime = 'a_tiempo' | 'proximo_a_vencer' | 'retrasado' | 'entregado'

export interface EvaluacionEntrega {
  estado: EstadoLeadTime
  diasRestantes: number
  diasTranscurridos: number
  diasDiferencia: number
  textoDescriptivo: string
  esRetraso: boolean
}

/**
 * Tabla de tiempos de entrega estimados por categoría de material de construcción e infraestructura eléctrica.
 */
export const LEAD_TIMES_POR_CATEGORIA: Record<string, MetricasLeadTime> = {
  // Obra Civil
  registros: {
    diasMin: 2,
    diasMax: 5,
    diasPromedio: 3,
    nivelCriticidad: 'media',
    etiquetaCategoria: 'Registros de Concreto',
  },
  tuberia: {
    diasMin: 1,
    diasMax: 4,
    diasPromedio: 2,
    nivelCriticidad: 'baja',
    etiquetaCategoria: 'Tubería y Canalización',
  },
  obra_civil: {
    diasMin: 2,
    diasMax: 6,
    diasPromedio: 4,
    nivelCriticidad: 'media',
    etiquetaCategoria: 'Obra Civil General',
  },

  // Electromecánico
  cableado: {
    diasMin: 4,
    diasMax: 10,
    diasPromedio: 7,
    nivelCriticidad: 'media',
    etiquetaCategoria: 'Cableado y Conductores',
  },
  accesorios_subterraneos: {
    diasMin: 5,
    diasMax: 12,
    diasPromedio: 8,
    nivelCriticidad: 'alta',
    etiquetaCategoria: 'Accesorios Subterráneos',
  },
  accesorios_aereos: {
    diasMin: 4,
    diasMax: 8,
    diasPromedio: 6,
    nivelCriticidad: 'media',
    etiquetaCategoria: 'Herrajes y Accesorios Aéreos',
  },
  alumbrado_publico: {
    diasMin: 6,
    diasMax: 14,
    diasPromedio: 10,
    nivelCriticidad: 'media',
    etiquetaCategoria: 'Alumbrado Público',
  },
  transformadores: {
    diasMin: 15,
    diasMax: 35,
    diasPromedio: 25,
    nivelCriticidad: 'alta',
    etiquetaCategoria: 'Transformadores y Subestaciones',
  },

  // Default
  general: {
    diasMin: 3,
    diasMax: 7,
    diasPromedio: 5,
    nivelCriticidad: 'media',
    etiquetaCategoria: 'Material General',
  },
}

/**
 * Determina las métricas de lead time a partir del nombre de la categoría o texto del material.
 */
export function obtenerLeadTimePorCategoria(categoriaOTexto?: string | null): MetricasLeadTime {
  if (!categoriaOTexto || typeof categoriaOTexto !== 'string') {
    return LEAD_TIMES_POR_CATEGORIA.general
  }

  const normalizado = categoriaOTexto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (normalizado.includes('transforma') || normalizado.includes('subestacion')) {
    return LEAD_TIMES_POR_CATEGORIA.transformadores
  }
  if (normalizado.includes('registro') || normalizado.includes('concreto')) {
    return LEAD_TIMES_POR_CATEGORIA.registros
  }
  if (normalizado.includes('tuberia') || normalizado.includes('tubo') || normalizado.includes('pad') || normalizado.includes('conduit')) {
    return LEAD_TIMES_POR_CATEGORIA.tuberia
  }
  if (normalizado.includes('cable') || normalizado.includes('alambre') || normalizado.includes('thw') || normalizado.includes('conductor')) {
    return LEAD_TIMES_POR_CATEGORIA.cableado
  }
  if (normalizado.includes('subterraneo') || normalizado.includes('codo') || normalizado.includes('pozo') || normalizado.includes('inserto')) {
    return LEAD_TIMES_POR_CATEGORIA.accesorios_subterraneos
  }
  if (normalizado.includes('herraje') || normalizado.includes('aereo') || normalizado.includes('cruceta') || normalizado.includes('abrazadera')) {
    return LEAD_TIMES_POR_CATEGORIA.accesorios_aereos
  }
  if (normalizado.includes('alumbrado') || normalizado.includes('luminaria') || normalizado.includes('poste') || normalizado.includes('foco')) {
    return LEAD_TIMES_POR_CATEGORIA.alumbrado_publico
  }
  if (normalizado.includes('civil')) {
    return LEAD_TIMES_POR_CATEGORIA.obra_civil
  }

  return LEAD_TIMES_POR_CATEGORIA.general
}

/**
 * Calcula la diferencia en días naturales completos entre dos fechas.
 */
export function diferenciaDias(fechaA: string | Date, fechaB: string | Date): number {
  const tA = new Date(fechaA).getTime()
  const tB = new Date(fechaB).getTime()
  if (isNaN(tA) || isNaN(tB)) return 0
  const msPorDia = 1000 * 60 * 60 * 24
  return Math.round((tB - tA) / msPorDia)
}

/**
 * Estima la fecha de entrega sumando los días promedio de la categoría a la fecha de inicio.
 */
export function estimarFechaEntrega(
  fechaInicio: string | Date,
  categoriaOTexto?: string | null
): Date {
  const inicio = new Date(fechaInicio)
  if (isNaN(inicio.getTime())) return new Date()

  const metricas = obtenerLeadTimePorCategoria(categoriaOTexto)
  const fechaEstimada = new Date(inicio)
  fechaEstimada.setDate(fechaEstimada.getDate() + metricas.diasPromedio)
  return fechaEstimada
}

/**
 * Evalúa el estatus de cumplimiento de entrega de una Orden de Compra.
 */
export function evaluarEstatusEntrega(params: {
  fechaEmision: string | Date
  fechaEntregaEstimada?: string | Date | null
  fechaRecepcionReal?: string | Date | null
  categoriaOTexto?: string | null
  fechaActualReferencia?: Date
}): EvaluacionEntrega {
  const {
    fechaEmision,
    fechaEntregaEstimada,
    fechaRecepcionReal,
    categoriaOTexto,
    fechaActualReferencia = new Date(),
  } = params

  const emision = new Date(fechaEmision)
  if (isNaN(emision.getTime())) {
    return {
      estado: 'a_tiempo',
      diasRestantes: 0,
      diasTranscurridos: 0,
      diasDiferencia: 0,
      textoDescriptivo: 'Fecha de emisión no disponible',
      esRetraso: false,
    }
  }

  const ahora = fechaActualReferencia

  // Determinar fecha meta estimada
  let meta: Date
  if (fechaEntregaEstimada && !isNaN(new Date(fechaEntregaEstimada).getTime())) {
    meta = new Date(fechaEntregaEstimada)
  } else {
    meta = estimarFechaEntrega(emision, categoriaOTexto)
  }

  // 1. Caso ya entregado
  if (fechaRecepcionReal && !isNaN(new Date(fechaRecepcionReal).getTime())) {
    const recepcion = new Date(fechaRecepcionReal)
    const diasTranscurridos = Math.max(0, diferenciaDias(emision, recepcion))
    const diferenciaMeta = diferenciaDias(meta, recepcion) // > 0 es entrega tardía

    return {
      estado: 'entregado',
      diasRestantes: 0,
      diasTranscurridos,
      diasDiferencia: diferenciaMeta,
      textoDescriptivo:
        diferenciaMeta > 0
          ? `Recibido con ${diferenciaMeta} día${diferenciaMeta === 1 ? '' : 's'} de demora`
          : `Recibido en tiempo (${diasTranscurridos} días)`,
      esRetraso: diferenciaMeta > 0,
    }
  }

  // 2. Caso en tránsito / pendiente
  const diasTranscurridos = Math.max(0, diferenciaDias(emision, ahora))
  const diasRestantes = diferenciaDias(ahora, meta)

  if (diasRestantes < 0) {
    const diasRetraso = Math.abs(diasRestantes)
    return {
      estado: 'retrasado',
      diasRestantes,
      diasTranscurridos,
      diasDiferencia: diasRetraso,
      textoDescriptivo: `Retrasada por ${diasRetraso} día${diasRetraso === 1 ? '' : 's'}`,
      esRetraso: true,
    }
  }

  if (diasRestantes <= 2) {
    return {
      estado: 'proximo_a_vencer',
      diasRestantes,
      diasTranscurridos,
      diasDiferencia: 0,
      textoDescriptivo:
        diasRestantes === 0
          ? 'Vence hoy'
          : diasRestantes === 1
            ? 'Vence mañana'
            : `Vence en ${diasRestantes} días`,
      esRetraso: false,
    }
  }

  return {
    estado: 'a_tiempo',
    diasRestantes,
    diasTranscurridos,
    diasDiferencia: 0,
    textoDescriptivo: `A tiempo (${diasRestantes} días restantes)`,
    esRetraso: false,
  }
}
