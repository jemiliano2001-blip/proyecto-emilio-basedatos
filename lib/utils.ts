import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export type { ClassValue }

/**
 * Utilidad canónica shadcn/ui para combinar y limpiar nombres de clases CSS condicionales.
 * Usa clsx + tailwind-merge para resolución inteligente de clases en conflicto.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
