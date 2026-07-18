/** Solo permite rutas relativas internas (bloquea //evil.com y URLs absolutas). */
export function sanitizeNextPath(raw: string | undefined | null): string {
  if (!raw) return '/'
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return '/'
  }
  return raw
}
