interface CacheEntry<T> {
  datos: T
  expiraEn: number
  creadoEn: number
}

const cacheStore = new Map<string, CacheEntry<unknown>>()
const DEFAULT_TTL_MS = 3 * 60 * 1000 // 3 minutos

/**
 * Guarda un resultado en la caché en memoria del cliente.
 */
export function guardarCacheQuery<T>(clave: string, datos: T, ttlMs = DEFAULT_TTL_MS): void {
  const ahora = Date.now()
  cacheStore.set(clave, {
    datos,
    expiraEn: ahora + ttlMs,
    creadoEn: ahora,
  })
}

/**
 * Obtiene un dato de la caché. Devuelve los datos y si ya sobrepasó su TTL.
 */
export function obtenerCacheQuery<T>(clave: string): { datos: T; expirado: boolean } | null {
  const entry = cacheStore.get(clave) as CacheEntry<T> | undefined
  if (!entry) return null

  const ahora = Date.now()
  const expirado = ahora >= entry.expiraEn
  return {
    datos: entry.datos,
    expirado,
  }
}

/**
 * Invalida entradas por clave exacta o prefijo (ej. 'solicitud:').
 */
export function invalidarCacheQuery(claveOPrefijo: string): void {
  for (const k of cacheStore.keys()) {
    if (k === claveOPrefijo || k.startsWith(claveOPrefijo)) {
      cacheStore.delete(k)
    }
  }
}

/**
 * Limpia toda la caché del cliente.
 */
export function limpiarCacheQuery(): void {
  cacheStore.clear()
}

/**
 * Ejecuta una consulta con patrón Stale-While-Revalidate en memoria.
 * Si existe en caché y no ha expirado, devuelve de inmediato sin invocar el fetcher.
 * Si expiró o no existe, ejecuta el fetcher y refresca la caché.
 */
export async function ejecutarConCache<T>(
  clave: string,
  fetcher: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS
): Promise<T> {
  const cached = obtenerCacheQuery<T>(clave)
  if (cached && !cached.expirado) {
    return cached.datos
  }

  const datos = await fetcher()
  guardarCacheQuery(clave, datos, ttlMs)
  return datos
}
