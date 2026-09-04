/** Redondea cantidades a 2 decimales (numeric(12,2) en Postgres). */
export function roundQuantity(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error('Cantidad inválida')
  }
  return Math.round(value * 100) / 100
}

export function parseQuantity(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.')
  if (normalized === '') return null
  const value = Number(normalized)
  if (!Number.isFinite(value)) return null
  return roundQuantity(value)
}

/** Parsea montos MXN (numeric(14,2)). */
export function parseMoney(raw: string): number | null {
  return parseQuantity(raw)
}

export function formatMoneyMx(value: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '$0.00'
  }
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(value)
}
