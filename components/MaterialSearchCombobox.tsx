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
  disabled?: boolean
}

function labelMaterial(m: MaterialComboboxOption): string {
  const agotado = m.disponible !== undefined && m.disponible !== null && m.disponible <= 0
  return `${m.nombre_base}${m.variante ? ` · ${m.variante}` : ''} (${m.unidad_medida})${
    agotado ? ' [Agotado — 0 disp.]' : ''
  }`
}

export function MaterialSearchCombobox({
  materials,
  value,
  onChange,
  placeholder = 'Selecciona un material',
  disabled = false,
}: {
  materials: MaterialComboboxOption[]
  value: string
  onChange: (materialId: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || (selected && query === labelMaterial(selected))) {
      return materials
    }
    return materials.filter((m) => {
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
  }, [materials, query, selected])

  return (
    <div ref={rootRef} className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        disabled={disabled}
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
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
          className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">Sin coincidencias</li>
          ) : (
            filtered.map((m) => {
              const estaAgotado =
                m.disabled ||
                (m.disponible !== undefined && m.disponible !== null && m.disponible <= 0)

              return (
                <li key={m.id} role="option" aria-selected={m.id === value}>
                  <button
                    type="button"
                    disabled={estaAgotado}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between ${
                      estaAgotado
                        ? 'opacity-50 cursor-not-allowed bg-gray-50 text-gray-400'
                        : m.id === value
                        ? 'bg-teal-50 text-[#132A45] hover:bg-teal-100/60'
                        : 'text-gray-800 hover:bg-gray-50'
                    }`}
                    onClick={() => {
                      if (estaAgotado) return
                      onChange(m.id)
                      setQuery(labelMaterial(m))
                      setOpen(false)
                    }}
                  >
                    <div>
                      <span className="font-medium">{m.nombre_base}</span>
                      {m.variante && <span className="text-gray-500"> · {m.variante}</span>}
                      <span className="text-gray-400"> ({m.unidad_medida})</span>
                      {m.subcategoria && (
                        <span className="block text-xs text-gray-400">{m.subcategoria}</span>
                      )}
                    </div>
                    {estaAgotado && (
                      <span className="shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                        Agotado (0 disp.)
                      </span>
                    )}
                  </button>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
