'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

export interface UseShiftSelectOptions<T> {
  items: T[]
  getItemId: (item: T) => string
}

export function useShiftSelect<T>({ items, getItemId }: UseShiftSelectOptions<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const lastSelectedIndexRef = useRef<number | null>(null)

  // Sincronización reactiva: podar IDs seleccionados que ya no existen en la lista
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev
      const currentIds = new Set(items.map(getItemId))
      let hasOrphans = false
      for (const id of prev) {
        if (!currentIds.has(id)) {
          hasOrphans = true
          break
        }
      }
      if (!hasOrphans) return prev
      const next = new Set<string>()
      for (const id of prev) {
        if (currentIds.has(id)) {
          next.add(id)
        }
      }
      return next
    })
  }, [items, getItemId])

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  )

  const toggleSelect = useCallback(
    (id: string, index: number, isShiftKey = false) => {
      setSelectedIds((prev) => {
        const next = new Set(prev)

        if (isShiftKey && lastSelectedIndexRef.current !== null) {
          const start = Math.min(lastSelectedIndexRef.current, index)
          const end = Math.max(lastSelectedIndexRef.current, index)

          // Decide whether we are adding or removing based on the target item
          const shouldAdd = !prev.has(id)

          for (let i = start; i <= end; i++) {
            const item = items[i]
            if (item) {
              const itemId = getItemId(item)
              if (shouldAdd) {
                next.add(itemId)
              } else {
                next.delete(itemId)
              }
            }
          }
        } else {
          if (next.has(id)) {
            next.delete(id)
          } else {
            next.add(id)
          }
        }

        lastSelectedIndexRef.current = index
        return next
      })
    },
    [items, getItemId]
  )

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map(getItemId)))
  }, [items, getItemId])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    lastSelectedIndexRef.current = null
  }, [])

  const selectOnly = useCallback((id: string, index?: number) => {
    setSelectedIds(new Set([id]))
    if (typeof index === 'number') {
      lastSelectedIndexRef.current = index
    }
  }, [])

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    isSelected,
    toggleSelect,
    selectAll,
    clearSelection,
    selectOnly,
    isAllSelected: items.length > 0 && selectedIds.size === items.length,
  }
}
