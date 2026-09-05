'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  IconCerrar,
  IconDocumento,
  IconMateriales,
  IconOrdenes,
  IconPaquete,
  IconPlus,
  IconProveedores,
  IconRayo,
  IconRecepcion,
  IconSearch,
  IconTraspasos,
} from '@/components/icons'
import { cn } from '@/lib/utils'

interface CommandItem {
  id: string
  label: string
  category: 'Navegación' | 'Acciones Rápidas'
  href: string
  icon: React.ComponentType<{ className?: string }>
  keywords?: string
}

const COMMANDS: CommandItem[] = [
  // Navegación
  {
    id: 'nav-obras',
    label: 'Proyectos y Obras',
    category: 'Navegación',
    href: '/',
    icon: IconPaquete,
    keywords: 'proyectos obras lista clientes',
  },
  {
    id: 'nav-solicitudes',
    label: 'Solicitudes y Requisiciones',
    category: 'Navegación',
    href: '/solicitudes',
    icon: IconDocumento,
    keywords: 'solicitud requisicion materiales pedidos',
  },
  {
    id: 'nav-ordenes',
    label: 'Órdenes de Compra (OC)',
    category: 'Navegación',
    href: '/ordenes',
    icon: IconOrdenes,
    keywords: 'ordenes compra cotizaciones facturas ocs',
  },
  {
    id: 'nav-recepciones',
    label: 'Recepciones en Obra',
    category: 'Navegación',
    href: '/recepciones',
    icon: IconRecepcion,
    keywords: 'recepcion sitio entrega revision',
  },
  {
    id: 'nav-traspasos',
    label: 'Traspasos entre Proyectos',
    category: 'Navegación',
    href: '/traspasos',
    icon: IconTraspasos,
    keywords: 'traspaso mover material sobrantes obras',
  },
  {
    id: 'nav-materiales',
    label: 'Catálogo de Materiales',
    category: 'Navegación',
    href: '/materiales',
    icon: IconMateriales,
    keywords: 'catalogo obra civil electromecanico tuberias cables',
  },
  {
    id: 'nav-kits',
    label: 'Kits y Ensambles',
    category: 'Navegación',
    href: '/kits',
    icon: IconRayo,
    keywords: 'kits ensambles transformador chiquitiaje plantillas',
  },
  {
    id: 'nav-proveedores',
    label: 'Directorio de Proveedores',
    category: 'Navegación',
    href: '/proveedores',
    icon: IconProveedores,
    keywords: 'proveedor empresas contactos compras',
  },
  {
    id: 'nav-avisos',
    label: 'Avisos y Notificaciones',
    category: 'Navegación',
    href: '/notificaciones',
    icon: IconDocumento,
    keywords: 'avisos notificaciones alertas campana',
  },

  // Acciones Rápidas
  {
    id: 'act-nueva-obra',
    label: 'Nuevo proyecto',
    category: 'Acciones Rápidas',
    href: '/obras/nueva',
    icon: IconPlus,
    keywords: 'crear obra dar alta proyecto nuevo',
  },
  {
    id: 'act-nueva-solicitud',
    label: 'Nueva solicitud de materiales',
    category: 'Acciones Rápidas',
    href: '/solicitudes/nueva',
    icon: IconPlus,
    keywords: 'requisicion pedir material crear solicitud',
  },
  {
    id: 'act-nuevo-traspaso',
    label: 'Nuevo traspaso de materiales',
    category: 'Acciones Rápidas',
    href: '/traspasos/nuevo',
    icon: IconPlus,
    keywords: 'transferir mover traspasar',
  },
  {
    id: 'act-nuevo-material',
    label: 'Nuevo material en catálogo',
    category: 'Acciones Rápidas',
    href: '/materiales/nuevo',
    icon: IconPlus,
    keywords: 'dar alta material nuevo producto',
  },
  {
    id: 'act-nuevo-kit',
    label: 'Nueva plantilla de Kit',
    category: 'Acciones Rápidas',
    href: '/kits/nuevo',
    icon: IconPlus,
    keywords: 'crear kit ensamble plantilla',
  },
  {
    id: 'act-nuevo-proveedor',
    label: 'Nuevo proveedor',
    category: 'Acciones Rápidas',
    href: '/proveedores/nuevo',
    icon: IconPlus,
    keywords: 'registrar proveedor alta proveedor',
  },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Atajo global Cmd+K o Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Auto-foco al abrir
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Filtrado de comandos
  const filtered = useMemo(() => {
    const q = (query || '').toLowerCase().trim()
    if (!q) return COMMANDS
    return COMMANDS.filter(
      (c) =>
        (c.label || '').toLowerCase().includes(q) ||
        (c.category || '').toLowerCase().includes(q) ||
        (c.keywords && c.keywords.toLowerCase().includes(q))
    )
  }, [query])

  // Ajustar selectedIndex al filtrar
  useEffect(() => {
    setSelectedIndex(0)
  }, [filtered.length])

  const handleSelect = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  // Navegación por teclado
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) =>
        prev <= 0 ? Math.max(0, filtered.length - 1) : prev - 1
      )
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIndex]) {
        handleSelect(filtered[selectedIndex].href)
      }
    }
  }

  // Scroll automático del item activo
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[data-active="true"]')
      if (activeEl instanceof HTMLElement) {
        activeEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 px-4 bg-black/50 backdrop-blur-sm print:hidden">
      {/* Backdrop */}
      <button
        type="button"
        className="fixed inset-0 w-full h-full cursor-default"
        onClick={() => setOpen(false)}
        aria-label="Cerrar buscador"
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscador global y atajos"
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[80vh] z-10 animate-fade-in"
      >
        {/* Header con Input */}
        <div className="flex items-center px-4 py-3 border-b border-gray-200 gap-2.5 bg-gray-50/50">
          <IconSearch className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Escribe para buscar proyectos, órdenes, materiales o acciones…"
            className="w-full bg-transparent text-sm text-ink placeholder-gray-400 outline-none font-medium"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-xs text-gray-400 hover:text-gray-600 p-1"
            >
              <IconCerrar className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold text-gray-400 bg-gray-100 border border-gray-200 rounded">
            ESC
          </kbd>
        </div>

        {/* Lista de Resultados */}
        <div
          ref={listRef}
          role="listbox"
          aria-label="Resultados de búsqueda"
          className="overflow-y-auto p-2 divide-y divide-gray-100 flex-1"
        >
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400">
              No se encontraron coincidencias para &quot;{query}&quot;.
            </div>
          ) : (
            filtered.map((item, index) => {
              const isActive = index === selectedIndex
              const Icon = item.icon
              return (
                <div
                  key={item.id}
                  role="option"
                  aria-selected={isActive}
                  data-active={isActive ? 'true' : 'false'}
                  onClick={() => handleSelect(item.href)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    'flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-xs transition-colors',
                    isActive
                      ? 'bg-teal-50 text-teal-900 font-semibold'
                      : 'text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={cn(
                        'p-1.5 rounded-lg shrink-0',
                        isActive
                          ? 'bg-accent text-white'
                          : 'bg-gray-100 text-gray-500'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="truncate">{item.label}</span>
                  </div>
                  <span
                    className={cn(
                      'text-[10px] px-2 py-0.5 rounded font-medium shrink-0',
                      item.category === 'Acciones Rápidas'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-gray-100 text-gray-500'
                    )}
                  >
                    {item.category}
                  </span>
                </div>
              )
            })
          )}
        </div>

        {/* Footer con ayuda */}
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-semibold text-gray-600">↑</kbd>{' '}
              <kbd className="font-semibold text-gray-600">↓</kbd> navegar
            </span>
            <span>
              <kbd className="font-semibold text-gray-600">↵</kbd> seleccionar
            </span>
          </div>
          <span>Atajo global: <strong>Cmd+K</strong></span>
        </div>
      </div>
    </div>
  )
}
