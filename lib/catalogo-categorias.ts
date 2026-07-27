/** Categorías fijas del catálogo (Emilio). */

export const CATEGORIAS_MATERIAL = ['Obra Civil', 'Electromecánico'] as const

export type CategoriaMaterial = (typeof CATEGORIAS_MATERIAL)[number]

export const SUBCATEGORIAS_POR_CATEGORIA: Record<
  CategoriaMaterial,
  readonly string[]
> = {
  'Obra Civil': ['Registros', 'Tubería'],
  Electromecánico: [
    'Transformadores',
    'Cableado',
    'Accesorios subterráneos',
    'Accesorios aéreos (herrajes)',
    'Alumbrado público',
  ],
}

export function subcategoriasDe(categoria: string | null | undefined): readonly string[] {
  if (categoria === 'Obra Civil' || categoria === 'Electromecánico') {
    return SUBCATEGORIAS_POR_CATEGORIA[categoria]
  }
  return []
}

export function esParCategoriaValido(
  categoria: string | null,
  subcategoria: string | null
): boolean {
  if (categoria === null && subcategoria === null) return true
  if (categoria === null || subcategoria === null) return false
  return subcategoriasDe(categoria).includes(subcategoria)
}
