'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  IconBitacora,
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
  IconProyectos,
  IconUsuarios,
} from '@/components/icons'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { ejecutarConCache } from '@/lib/cache-query-cliente'
import { useModalFocus } from '@/lib/hooks/useModalFocus'
import {
  puedeCapturarRecepcion,
  puedeCrearSolicitudes,
  puedeGestionarCatalogo,
  puedeGestionarKits,
  puedeGestionarObras,
  puedeGestionarProveedores,
  puedeGestionarUsuarios,
  puedeVerBitacora,
  puedeVerInventarioCampo,
  puedeVerNavProyectos,
  puedeVerPrecios,
  puedeVerRecepciones,
  puedeVerTraspasos,
} from '@/lib/roles'
import type { RolUsuario } from '@/lib/types'

interface CommandItem {
  id: string
  label: string
  category: 'Proyectos' | 'Materiales' | 'Navegación' | 'Acciones Rápidas'
  href: string
  icon: React.ComponentType<{ className?: string }>
  keywords?: string
}

const STATIC_COMMANDS: CommandItem[] = [
  // Navegación
  {
    id: 'nav-obras',
    label: 'Proyectos y Obras',
    category: 'Navegación',
    href: '/',
    icon: IconProyectos,
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
    keywords: 'recepcion sitio entrega revision remisiones',
  },
  {
    id: 'nav-inventario',
    label: 'Inventario en obra',
    category: 'Navegación',
    href: '/inventario',
    icon: IconPaquete,
    keywords: 'inventario instalado pendiente campo stock recibido',
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
    id: 'nav-usuarios',
    label: 'Usuarios y roles',
    category: 'Navegación',
    href: '/usuarios',
    icon: IconUsuarios,
    keywords: 'usuarios cuentas roles acceso total admin',
  },
  {
    id: 'nav-bitacora',
    label: 'Bitácora de auditoría',
    category: 'Navegación',
    href: '/bitacora',
    icon: IconBitacora,
    keywords: 'bitacora auditoria cambios historial',
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
    id: 'act-nueva-recepcion',
    label: 'Recibir material en obra',
    category: 'Acciones Rápidas',
    href: '/recepciones',
    icon: IconPlus,
    keywords: 'remision cotejo captura llegada obra',
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
  {
    id: 'act-nuevo-usuario',
    label: 'Nuevo usuario',
    category: 'Acciones Rápidas',
    href: '/usuarios/nuevo',
    icon: IconPlus,
    keywords: 'crear usuario alta cuenta',
  },
]

function commandAllowed(command: CommandItem, rol: RolUsuario | null, traspasosDisponibles: boolean): boolean {
  if (command.id === 'nav-obras') return puedeVerNavProyectos(rol)
  if (command.id === 'nav-ordenes') return puedeVerPrecios(rol)
  if (command.id === 'nav-recepciones') return puedeVerRecepciones(rol)
  if (command.id === 'nav-inventario') return puedeVerInventarioCampo(rol)
  if (command.id === 'nav-traspasos' || command.id === 'act-nuevo-traspaso') return traspasosDisponibles && puedeVerTraspasos(rol)
  if (command.id === 'nav-proveedores' || command.id === 'act-nuevo-proveedor') return puedeGestionarProveedores(rol)
  if (command.id === 'nav-usuarios' || command.id === 'act-nuevo-usuario') return puedeGestionarUsuarios(rol)
  if (command.id === 'nav-bitacora') return puedeVerBitacora(rol)
  if (command.id === 'nav-materiales' || command.id === 'nav-kits') return rol !== 'personal'
  if (command.id === 'act-nueva-obra') return puedeGestionarObras(rol)
  if (command.id === 'act-nueva-solicitud') return puedeCrearSolicitudes(rol)
  if (command.id === 'act-nueva-recepcion') return puedeCapturarRecepcion(rol)
  if (command.id === 'act-nuevo-material') return puedeGestionarCatalogo(rol)
  if (command.id === 'act-nuevo-kit') return puedeGestionarKits(rol)
  return true
}

export function CommandPalette({ rol, userId, traspasosDisponibles }: { rol: RolUsuario | null; userId: string; traspasosDisponibles: boolean }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [dynamicResults, setDynamicResults] = useState<CommandItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState(false)

  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)
  const requestSequence = useRef(0)
  useModalFocus(open, dialogRef, inputRef)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

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

    const handleCustomOpen = () => setOpen(true)

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('open-command-palette', handleCustomOpen)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('open-command-palette', handleCustomOpen)
    }
  }, [])

  // Auto-foco al abrir
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setDynamicResults([])
      setSearchError(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Búsqueda dinámica en Supabase para proyectos y materiales
  useEffect(() => {
    const trimmed = query.trim().toLowerCase()
    const safeTerm = trimmed.replace(/[%_,().]/g, ' ').replace(/\s+/g, ' ').trim()
    if (safeTerm.length < 2) {
      requestSequence.current += 1
      setDynamicResults([])
      setIsSearching(false)
      setSearchError(false)
      return
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    setIsSearching(true)
    setSearchError(false)
    const requestId = ++requestSequence.current
    debounceTimer.current = setTimeout(async () => {
      try {
        const items = await ejecutarConCache(
          `command:${userId}:${safeTerm}`,
          async () => {
            const supabase = createClient()
            const [obrasRes, matsRes] = await Promise.all([
              puedeVerNavProyectos(rol)
                ? supabase.from('obras').select('id, nombre, cliente').or(`nombre.ilike.%${safeTerm}%,cliente.ilike.%${safeTerm}%`).limit(4)
                : Promise.resolve({ data: [], error: null }),
              rol !== 'personal'
                ? supabase.from('catalogo_materiales').select('id, nombre_base, variante, unidad_medida').ilike('nombre_base', `%${safeTerm}%`).limit(5)
                : Promise.resolve({ data: [], error: null }),
            ])
            if (obrasRes.error || matsRes.error) throw obrasRes.error ?? matsRes.error
            return [
              ...(obrasRes.data ?? []).map((o) => ({
                id: `obra-${o.id}`,
                label: `${o.nombre}${o.cliente ? ` (${o.cliente})` : ''}`,
                category: 'Proyectos' as const,
                href: `/obras/${o.id}`,
                icon: IconProyectos,
              })),
              ...(matsRes.data ?? []).map((m) => ({
                id: `mat-${m.id}`,
                label: `${m.nombre_base}${m.variante ? ` · ${m.variante}` : ''} (${m.unidad_medida})`,
                category: 'Materiales' as const,
                href: `/materiales/${m.id}`,
                icon: IconPaquete,
              })),
            ]
          },
          60_000
        )
        if (requestId === requestSequence.current) setDynamicResults(items)
      } catch {
        if (requestId === requestSequence.current) setSearchError(true)
      } finally {
        if (requestId === requestSequence.current) setIsSearching(false)
      }
    }, 180)

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [query, rol, userId])

  // Filtrado de comandos estáticos y unión con dinámicos
  const filtered = useMemo(() => {
    const q = (query || '').toLowerCase().trim()
    const allowedCommands = STATIC_COMMANDS.filter((command) => commandAllowed(command, rol, traspasosDisponibles))
    const staticFiltered = !q
      ? allowedCommands
      : allowedCommands.filter(
          (c) =>
            (c.label || '').toLowerCase().includes(q) ||
            (c.category || '').toLowerCase().includes(q) ||
            (c.keywords && c.keywords.toLowerCase().includes(q))
        )

    // Resultados dinámicos primero si existen
    return [...dynamicResults, ...staticFiltered]
  }, [query, dynamicResults, rol, traspasosDisponibles])

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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 px-4 bg-foreground/50 backdrop-blur-sm print:hidden">
      {/* Backdrop */}
      <button
        type="button"
        className="fixed inset-0 w-full h-full cursor-default"
        onClick={() => setOpen(false)}
        aria-label="Cerrar buscador"
      />

      {/* Modal Dialog */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Buscador global y comandos"
        className="relative w-full max-w-lg bg-card rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[80vh] z-10 animate-fade-in"
      >
        {/* Header con Input */}
        <div className="flex items-center px-4 py-3 border-b border-border gap-2.5 bg-muted/40">
          <IconSearch className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Escribe para buscar proyectos, materiales o comandos…"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none font-medium"
            aria-controls="command-results"
            aria-activedescendant={filtered[selectedIndex] ? `command-${filtered[selectedIndex].id}` : undefined}
          />
          {isSearching && (
            <span className="text-[10px] text-muted-foreground font-mono animate-pulse">
              Buscando...
            </span>
          )}
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center text-xs text-muted-foreground hover:text-foreground"
              aria-label="Limpiar búsqueda"
            >
              <IconCerrar className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold text-foreground bg-muted border border-border rounded">
            ESC
          </kbd>
        </div>

        {/* Lista de Resultados */}
        <div
          ref={listRef}
          id="command-results"
          role="listbox"
          aria-label="Resultados de búsqueda"
          className="overflow-y-auto p-2 divide-y divide-border/50 flex-1"
        >
          {searchError ? (
            <div className="py-8 text-center text-sm text-danger-soft-foreground" role="status">
              No se pudo completar la búsqueda en línea. Revisa tu conexión e intenta de nuevo.
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No se encontraron coincidencias para &quot;{query}&quot;.
            </div>
          ) : (
            filtered.map((item, index) => {
              const isActive = index === selectedIndex
              const Icon = item.icon
              return (
                <div
                  key={item.id}
                  id={`command-${item.id}`}
                  role="option"
                  aria-selected={isActive}
                  data-active={isActive ? 'true' : 'false'}
                  onClick={() => handleSelect(item.href)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    'flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-xs transition-colors',
                    isActive
                      ? 'bg-primary/15 text-primary font-semibold'
                      : 'text-foreground hover:bg-muted/60'
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={cn(
                        'p-1.5 rounded-lg shrink-0',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : item.category === 'Proyectos'
                            ? 'bg-muted text-foreground'
                            : item.category === 'Materiales'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="truncate">{item.label}</span>
                  </div>
                  <span
                    className={cn(
                      'text-[10px] px-2 py-0.5 rounded font-medium shrink-0',
                      item.category === 'Proyectos'
                        ? 'bg-muted text-foreground font-semibold'
                        : item.category === 'Materiales'
                          ? 'bg-primary/15 text-primary font-semibold'
                          : item.category === 'Acciones Rápidas'
                            ? 'bg-warning-soft text-warning-soft-foreground'
                            : 'bg-muted text-muted-foreground'
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
        <div className="px-4 py-2 bg-muted/40 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-semibold text-foreground">↑</kbd>{' '}
              <kbd className="font-semibold text-foreground">↓</kbd> navegar
            </span>
            <span>
              <kbd className="font-semibold text-foreground">↵</kbd> seleccionar
            </span>
          </div>
          <span>Atajo global: <strong>Ctrl+K</strong> / <strong>⌘K</strong></span>
        </div>
      </div>
    </div>
  )
}
