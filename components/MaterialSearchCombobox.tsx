'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'

export interface MaterialComboboxOption {
  id: string
  nombre_base: string
  variante: string | null
  unidad_medida: string
  categoria?: string | null
  subcategoria?: string | null
  disponible?: number | null
  comprometido?: number | null
  disabled?: boolean
}

function labelMaterial(m: MaterialComboboxOption): string {
  const disp =
    m.disponible !== undefined && m.disponible !== null
      ? ` [Disp: ${m.disponible} ${m.unidad_medida}]`
      : ''
  return `${m.nombre_base}${m.variante ? ` · ${m.variante}` : ''} (${m.unidad_medida})${disp}`
}

export function MaterialSearchCombobox({
  materials,
  value,
  onChange,
  placeholder = 'Selecciona un material con saldo disponible',
  disabled = false,
  showDetailBelow = true,
}: {
  materials: MaterialComboboxOption[]
  value: string
  onChange: (materialId: string) => void
  placeholder?: string
  disabled?: boolean
  showDetailBelow?: boolean
}) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = materials.find((m) => m.id === value) ?? null

  useEffect(() => {
    if (selected) {
      setQuery(labelMaterial(selected))
    } else if (!value) {
      setQuery('')
    }
  }, [selected, value])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
        if (selected) setQuery(labelMaterial(selected))
        else setQuery('')
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [selected])

  // Filtrar solo los que tienen saldo disponible > 0
  const soloDisponibles = useMemo(() => {
    return materials.filter(
      (m) =>
        !m.disabled &&
        (m.disponible === undefined || m.disponible === null || m.disponible > 0)
    )
  }, [materials])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || (selected && query === labelMaterial(selected))) {
      return soloDisponibles
    }
    return soloDisponibles.filter((m) => {
      const haystack = [
        m.nombre_base,
        m.variante ?? '',
        m.unidad_medida,
        m.categoria ?? '',
        m.subcategoria ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [soloDisponibles, query, selected])

  return (
    <div ref={rootRef} className="relative space-y-1">
      <input
        ref={inputRef}
        aria-label={placeholder}
        aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false)
            setQuery(selected ? labelMaterial(selected) : '')
            return
          }
          if (event.key === 'Tab') {
            setOpen(false)
            return
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
            const enabled = filtered.map((m, i) => ({ m, i })).map(({ i }) => i)
            if (enabled.length === 0) return
            const position = enabled.indexOf(activeIndex)
            const next =
              event.key === 'ArrowDown'
                ? (position + 1) % enabled.length
                : position <= 0
                ? enabled.length - 1
                : position - 1
            const index = enabled[next] ?? -1
            setActiveIndex(index)
            document.getElementById(`${listId}-${index}`)?.scrollIntoView({ block: 'nearest' })
          }
          if (event.key === 'Enter') {
            event.preventDefault()
            if (open) {
              const item = filtered[activeIndex]
              if (item) {
                onChange(item.id)
                setQuery(labelMaterial(item))
                setOpen(false)
              }
            }
          }
        }}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        disabled={disabled}
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setActiveIndex(-1)
          setQuery(e.target.value)
          setOpen(true)
          if (value) onChange('')
        }}
        onFocus={() => setOpen(true)}
        className="input-base"
        autoComplete="off"
      />

      {open && !disabled && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg py-1"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-xs text-muted-foreground text-center">
              Sin materiales con saldo disponible
            </li>
          ) : (
            filtered.map((m, index) => {
              const isSelected = m.id === value
              return (
                <li
                  id={`${listId}-${index}`}
                  key={m.id}
                  role="option"
                  aria-selected={isSelected}
                  className={index === activeIndex ? 'bg-primary/10 ring-1 ring-inset ring-ring' : ''}
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    className={`min-h-[44px] w-full text-left px-3 py-2 text-xs sm:text-sm flex items-center justify-between gap-2 border-b border-border/40 last:border-0 ${
                      isSelected
                        ? 'bg-primary/15 text-foreground font-semibold hover:bg-primary/20'
                        : 'text-foreground hover:bg-muted'
                    }`}
                    onClick={() => {
                      onChange(m.id)
                      setQuery(labelMaterial(m))
                      setOpen(false)
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-foreground">{m.nombre_base}</span>
                        {m.variante && <span className="text-muted-foreground">· {m.variante}</span>}
                        <span className="text-muted-foreground font-medium">({m.unidad_medida})</span>
                      </div>
                      {m.subcategoria && (
                        <span className="block text-[11px] text-muted-foreground mt-0.5">{m.subcategoria}</span>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      {m.disponible !== undefined && m.disponible !== null && (
                        <span className="inline-block font-bold text-primary-soft-foreground bg-primary-soft px-2 py-0.5 rounded text-xs">
                          {m.disponible} {m.unidad_medida} disp.
                        </span>
                      )}
                      {m.comprometido !== undefined && m.comprometido !== null && m.comprometido > 0 && (
                        <span className="block text-[10px] text-warning-soft-foreground font-medium mt-0.5">
                          {m.comprometido} comp.
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      )}

      {/* Visualización de disponibilidad del material seleccionado */}
      {showDetailBelow && selected && (
        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
          <span className="font-semibold text-primary-soft-foreground bg-primary-soft px-2 py-0.5 rounded-md border border-primary/30">
            Disponible actual: {selected.disponible ?? 0} {selected.unidad_medida}
          </span>
          {selected.comprometido !== undefined && selected.comprometido !== null && selected.comprometido > 0 && (
            <span className="font-medium text-warning-soft-foreground bg-warning-soft px-2 py-0.5 rounded-md border border-warning/30">
              Comprometido en requisiciones: {selected.comprometido} {selected.unidad_medida}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
