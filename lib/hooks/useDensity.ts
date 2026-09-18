'use client'

import { useState, useEffect, useCallback } from 'react'

export type DisplayDensity = 'compact' | 'comfortable'

const STORAGE_KEY = 'obratrack-density'

export function useDensity() {
  const [density, setDensityState] = useState<DisplayDensity>('comfortable')
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as DisplayDensity | null
      if (stored === 'compact' || stored === 'comfortable') {
        setDensityState(stored)
      } else {
        // Por defecto: cómodo en móvil (< 768px), compacto en desktop
        const isMobile = window.innerWidth < 768
        setDensityState(isMobile ? 'comfortable' : 'compact')
      }
    } catch {
      // Si localStorage está bloqueado
      setDensityState('comfortable')
    } finally {
      setIsReady(true)
    }
  }, [])

  const setDensity = useCallback((newDensity: DisplayDensity) => {
    setDensityState(newDensity)
    try {
      localStorage.setItem(STORAGE_KEY, newDensity)
    } catch {
      // Ignorar fallos de almacenamiento local
    }
  }, [])

  const toggleDensity = useCallback(() => {
    setDensity(density === 'compact' ? 'comfortable' : 'compact')
  }, [density, setDensity])

  return {
    density,
    setDensity,
    toggleDensity,
    isCompact: density === 'compact',
    isComfortable: density === 'comfortable',
    isReady,
  }
}
