/** Frase del recorrido en vivo: No se encontraron … para "x". */
export function mensajeSinResultados(sustantivo: string, consulta?: string | null): string {
  const termino = consulta?.trim() ? consulta.trim() : 'estos filtros'
  return `No se encontraron ${sustantivo} para "${termino}"`
}
