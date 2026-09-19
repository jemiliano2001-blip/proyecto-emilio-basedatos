'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

export interface SelectCustomProps {
  options: SelectOption[]
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  label?: string
  error?: string
  searchable?: boolean
  className?: string
}

export function SelectCustom({
  options,
  value: controlledValue,
  defaultValue = '',
  onChange,
  placeholder = 'Selecciona una opción...',
  disabled = false,
  label,
  error,
  searchable = false,
  className,
}: SelectCustomProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [highlightedIndex, setHighlightedIndex] = React.useState(0)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const listboxId = React.useId()

  const isControlled = controlledValue !== undefined
  const selectedValue = isControlled ? controlledValue : uncontrolledValue
  const selectedOption = options.find((opt) => opt.value === selectedValue)

  const filteredOptions = React.useMemo(() => {
    if (!searchable || !searchQuery.trim()) return options
    const query = searchQuery.toLowerCase()
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        (opt.description && opt.description.toLowerCase().includes(query))
    )
  }, [options, searchable, searchQuery])

  const handleSelect = (val: string) => {
    if (!isControlled) {
      setUncontrolledValue(val)
    }
    onChange?.(val)
    setIsOpen(false)
    setSearchQuery('')
  }

  // Cerrar al hacer clic afuera
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Navegación con teclado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev + 1) % (filteredOptions.length || 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev - 1 + filteredOptions.length) % (filteredOptions.length || 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = filteredOptions[highlightedIndex]
      if (target && !target.disabled) {
        handleSelect(target.value)
      }
    }
  }

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      {label && <label className="field-label">{label}</label>}

      <button
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className={cn(
          'input-base flex items-center justify-between text-left cursor-pointer transition-all duration-180',
          isOpen && 'border-primary ring-2 ring-primary/20',
          error && 'border-danger focus:ring-danger/20',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <span className={cn('truncate', !selectedOption && 'text-muted-foreground')}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        <svg
          className={cn(
            'size-4 text-muted-foreground transition-transform duration-200 shrink-0 ml-2',
            isOpen && 'rotate-180 text-primary'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {error && (
        <p className="field-error">
          <svg className="size-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </p>
      )}

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1.5 w-full rounded-2xl border border-border bg-card p-1.5 shadow-elevated animate-scale-in"
        >
          {searchable && (
            <div className="p-1 pb-2 border-b border-border/70 mb-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar..."
                className="w-full rounded-xl bg-muted/60 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          <div className="max-h-60 overflow-y-auto [scrollbar-width:thin]">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-3 text-center text-xs text-muted-foreground">
                No se encontraron opciones
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === selectedValue
                const isHighlighted = idx === highlightedIndex

                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-sm transition-colors duration-150 cursor-pointer',
                      isSelected
                        ? 'bg-primary-soft text-primary font-semibold'
                        : isHighlighted
                        ? 'bg-muted/80 text-foreground'
                        : 'text-foreground hover:bg-muted/60',
                      opt.disabled && 'cursor-not-allowed opacity-40'
                    )}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="truncate">{opt.label}</span>
                      {opt.description && (
                        <span className="text-xs text-muted-foreground truncate font-normal">
                          {opt.description}
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <svg className="size-4 shrink-0 text-primary ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
