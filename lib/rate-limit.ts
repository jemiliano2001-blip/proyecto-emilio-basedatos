interface RateLimitEntry {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()
const MAX_ENTRIES = 5000

function cleanupExpiredEntries(now: number, windowMs: number) {
  if (store.size < MAX_ENTRIES) return
  for (const [key, entry] of store.entries()) {
    const validTimestamps = entry.timestamps.filter((ts) => now - ts < windowMs)
    if (validTimestamps.length === 0) {
      store.delete(key)
    } else {
      entry.timestamps = validTimestamps
    }
  }
}

export interface RateLimitOptions {
  maxRequests: number
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetMs: number
}

/**
 * Limitador de tasa en memoria por ventana deslizante.
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now()
  cleanupExpiredEntries(now, options.windowMs)

  let entry = store.get(key)
  if (!entry) {
    entry = { timestamps: [] }
    store.set(key, entry)
  }

  // Filtrar timestamps fuera de la ventana actual
  entry.timestamps = entry.timestamps.filter((ts) => now - ts < options.windowMs)

  if (entry.timestamps.length >= options.maxRequests) {
    const oldest = entry.timestamps[0] ?? now
    const resetMs = Math.max(0, options.windowMs - (now - oldest))
    return {
      allowed: false,
      remaining: 0,
      resetMs,
    }
  }

  entry.timestamps.push(now)
  return {
    allowed: true,
    remaining: options.maxRequests - entry.timestamps.length,
    resetMs: options.windowMs,
  }
}

export function resetRateLimit(key: string): void {
  store.delete(key)
}

/**
 * Obtiene la IP del cliente desde los encabezados HTTP estándar.
 */
export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get('x-forwarded-for')
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = headers.get('x-real-ip')
  if (realIp?.trim()) return realIp.trim()
  return '127.0.0.1'
}
