/** Zona fija de la obra. El servidor (Vercel) corre en UTC; la pantalla no. */
export const ZONA_OBRA = 'America/Matamoros'

/** Lo que no tiene fecha. Un solo texto, en toda la app. */
export const SIN_DATO = 'Sin dato'

type PartesReloj = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function fechaValida(iso: string | Date): Date | null {
  // YYYY-MM-DD es un día civil, no medianoche UTC. En el servidor (UTC) esa
  // medianoche cae el día anterior en Matamoros.
  if (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const inicio = inicioDiaZona(iso)
    return inicio ? new Date(inicio) : null
  }
  const date = iso instanceof Date ? iso : new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function partesEnZona(date: Date, timeZone: string): PartesReloj {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const map: Record<string, string> = {}
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = part.value
  }
  let year = Number(map.year)
  let month = Number(map.month)
  let day = Number(map.day)
  let hour = Number(map.hour)
  if (hour === 24) {
    hour = 0
    const siguiente = new Date(Date.UTC(year, month - 1, day) + 86_400_000)
    year = siguiente.getUTCFullYear()
    month = siguiente.getUTCMonth() + 1
    day = siguiente.getUTCDate()
  }
  return {
    year,
    month,
    day,
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
  }
}

function claveDia(partes: PartesReloj): string {
  const mes = String(partes.month).padStart(2, '0')
  const dia = String(partes.day).padStart(2, '0')
  return `${partes.year}-${mes}-${dia}`
}

function offsetMinutos(date: Date, timeZone: string): number {
  const partes = partesEnZona(date, timeZone)
  const comoUtc = Date.UTC(
    partes.year,
    partes.month - 1,
    partes.day,
    partes.hour,
    partes.minute,
    partes.second
  )
  return Math.round((comoUtc - date.getTime()) / 60_000)
}

/**
 * Fecha y hora de la obra: `20/10/2026 7:28 p.m.`
 * Es el único formato de un instante. Si falta, `Sin dato`.
 */
export function fechaHora(
  iso: string | Date | null | undefined,
  timeZone: string = ZONA_OBRA
): string {
  if (iso == null || iso === '') return SIN_DATO
  const date = fechaValida(iso)
  if (!date) return SIN_DATO
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const map: Record<string, string> = {}
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = part.value
  }
  const periodo = (map.dayPeriod ?? '').toLowerCase().startsWith('p') ? 'p.m.' : 'a.m.'
  return `${map.day}/${map.month}/${map.year} ${map.hour}:${map.minute} ${periodo}`
}

/** Solo el día civil en la zona de la obra: `20/10/2026`. */
export function soloFecha(
  iso: string | Date | null | undefined,
  timeZone: string = ZONA_OBRA
): string {
  if (iso == null || iso === '') return SIN_DATO
  const date = fechaValida(iso)
  if (!date) return SIN_DATO
  const partes = partesEnZona(date, timeZone)
  const dia = String(partes.day).padStart(2, '0')
  const mes = String(partes.month).padStart(2, '0')
  return `${dia}/${mes}/${partes.year}`
}

/** Mismo día civil que `soloFecha`. El impreso no usa otro formato. */
export function fechaDocumento(
  iso: string | Date | null | undefined,
  timeZone: string = ZONA_OBRA
): string {
  return soloFecha(iso, timeZone)
}

/** Encabezado de la Bitácora: `martes, 20 de octubre de 2026`. */
export function encabezadoDia(
  iso: string | Date | null | undefined,
  timeZone: string = ZONA_OBRA
): string {
  if (iso == null || iso === '') return SIN_DATO
  const date = fechaValida(iso)
  if (!date) return SIN_DATO
  return new Intl.DateTimeFormat('es-MX', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
    .format(date)
    .toLowerCase()
}

/** Hora de 12 h de un instante: `7:28 p.m.` */
export function hora12(
  iso: string | Date | null | undefined,
  timeZone: string = ZONA_OBRA
): string {
  const completa = fechaHora(iso, timeZone)
  if (completa === SIN_DATO) return SIN_DATO
  const espacio = completa.indexOf(' ')
  return espacio === -1 ? completa : completa.slice(espacio + 1)
}

/** Agrupa en orden, por el día civil de Matamoros. */
export function agruparPorDia<T>(
  items: readonly T[],
  fechaDe: (item: T) => string | null | undefined
): { dia: string; items: T[] }[] {
  const grupos: { dia: string; items: T[] }[] = []
  for (const item of items) {
    const dia = encabezadoDia(fechaDe(item))
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.dia === dia) ultimo.items.push(item)
    else grupos.push({ dia, items: [item] })
  }
  return grupos
}

export const formatearFechaBitacora = fechaHora
export const formatearFechaLista = fechaHora

/** Inicio del día civil (00:00 en la zona de la obra), en UTC. */
export function inicioDiaZona(fecha: string, timeZone: string = ZONA_OBRA): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null
  const [anio, mes, dia] = fecha.split('-').map(Number)
  if (!anio || !mes || !dia || mes > 12 || dia > 31) return null
  const mediodia = new Date(Date.UTC(anio, mes - 1, dia, 12, 0, 0))
  const offset = offsetMinutos(mediodia, timeZone)
  let inicio = new Date(Date.UTC(anio, mes - 1, dia, 0, 0, 0) - offset * 60_000)
  const clave = claveDia(partesEnZona(inicio, timeZone))
  if (clave !== fecha) {
    inicio = new Date(inicio.getTime() + (clave < fecha ? 1 : -1) * 3_600_000)
  }
  if (claveDia(partesEnZona(inicio, timeZone)) !== fecha) return null
  return inicio.toISOString()
}

/** Inicio del día siguiente: límite exclusivo de un filtro `hasta`. */
export function finDiaZonaExclusivo(fecha: string, timeZone: string = ZONA_OBRA): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const siguiente = new Date(Date.UTC(anio, mes - 1, dia + 1))
  const clave = [
    siguiente.getUTCFullYear(),
    String(siguiente.getUTCMonth() + 1).padStart(2, '0'),
    String(siguiente.getUTCDate()).padStart(2, '0'),
  ].join('-')
  return inicioDiaZona(clave, timeZone)
}
