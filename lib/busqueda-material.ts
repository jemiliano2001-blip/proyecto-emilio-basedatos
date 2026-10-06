/**
 * Búsqueda de materiales en cliente: sin acentos, sin importar el orden de las palabras
 * y tolerante a typos. Cada palabra de la consulta debe coincidir con alguna palabra del material.
 */

export function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function palabras(texto: string): string[] {
  return normalizarTexto(texto).split(/[^a-z0-9]+/).filter(Boolean)
}

/** Distancia de edición (Damerau/OSA): una transposición cuenta como 1. */
function distancia(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
    }
  }
  return d[a.length][b.length]
}

/** 0 exacto · 1 prefijo · 2 contiene · 3+ difuso · Infinity sin coincidencia. */
function puntajePalabra(token: string, candidatas: string[]): number {
  let mejor = Infinity
  // Difuso solo en palabras sin números de 4+ letras: "calibre 13" no debe coincidir con "calibre 12".
  const difuso = token.length >= 4 && !/\d/.test(token)
  const maxDist = token.length <= 6 ? 1 : 2
  for (const palabra of candidatas) {
    let p = Infinity
    if (palabra === token) p = 0
    else if (palabra.startsWith(token)) p = 1
    else if (palabra.includes(token)) p = 2
    else if (difuso) {
      const dist = Math.min(distancia(token, palabra), distancia(token, palabra.slice(0, token.length)))
      if (dist <= maxDist) p = 3 + dist
    }
    if (p < mejor) mejor = p
  }
  return mejor
}

/**
 * Filtra y ordena por relevancia. `textos` devuelve los campos buscables de cada elemento
 * (nombre, variante, categoría, alias…). Consulta vacía: devuelve la lista tal cual.
 */
export function buscarMateriales<T>(items: T[], consulta: string, textos: (item: T) => string[]): T[] {
  const tokens = palabras(consulta)
  if (tokens.length === 0) return items
  const resultados: { item: T; puntaje: number; orden: number }[] = []
  items.forEach((item, orden) => {
    const candidatas = textos(item).flatMap(palabras)
    let puntaje = 0
    for (const token of tokens) {
      const p = puntajePalabra(token, candidatas)
      if (p === Infinity) return
      puntaje += p
    }
    resultados.push({ item, puntaje, orden })
  })
  return resultados.sort((a, b) => a.puntaje - b.puntaje || a.orden - b.orden).map((r) => r.item)
}
