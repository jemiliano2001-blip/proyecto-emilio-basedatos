'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { logoutAction } from '@/lib/actions/auth'
import {
  IconBitacora,
  IconCerrar,
  IconMateriales,
  IconOrdenes,
  IconPaquete,
  IconProveedores,
  IconRayo,
  IconRecepcion,
  IconSalir,
  IconTraspasos,
  IconUsuarios,
} from '@/components/icons'

export function MoreSheet({
  open,
  onClose,
  puedeVerPrecios,
  puedeVerTraspasos,
  puedeGestionarProveedores,
  puedeVerRecepciones,
  mostrarOrdenesEnMas,
  mostrarRecepcionEnMas,
  traspasosDisponibles,
  vistaCampoLimitada = false,
  puedeVerInventario = false,
  puedeGestionarUsuarios = false,
  puedeVerBitacora = false,
}: {
  open: boolean
  onClose: () => void
  puedeVerPrecios: boolean
  puedeVerTraspasos: boolean
  puedeGestionarProveedores: boolean
  puedeVerRecepciones: boolean
  mostrarOrdenesEnMas: boolean
  mostrarRecepcionEnMas: boolean
  traspasosDisponibles: boolean
  vistaCampoLimitada?: boolean
  puedeVerInventario?: boolean
  puedeGestionarUsuarios?: boolean
  puedeVerBitacora?: boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const first = panelRef.current?.querySelector<HTMLElement>('button, a')
    first?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab') {
        const elements = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]') ?? [])
        const first = elements[0], last = elements[elements.length - 1]
        if (!first) { e.preventDefault(); return }
        if (e.shiftKey && (document.activeElement === first || !panelRef.current?.contains(document.activeElement))) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && (document.activeElement === last || !panelRef.current?.contains(document.activeElement))) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previousFocus.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  const itemClass =
    'flex min-h-[48px] items-center gap-3 rounded-lg px-3 text-base font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
        aria-label="Cerrar menú"
        onClick={onClose}
      />
      <div
        id="mas-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mas-titulo"
        ref={panelRef}
        className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-border bg-card px-4 pt-3 shadow-lg animate-slide-in-bottom"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 id="mas-titulo" className="text-base font-bold text-foreground">
            Más
          </h2>
          <button
            type="button"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <IconCerrar className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {!vistaCampoLimitada && (
            <Link href="/materiales" className={itemClass} onClick={onClose}>
              <IconMateriales className="h-5 w-5 shrink-0" />
              Materiales
            </Link>
          )}

          {!vistaCampoLimitada && (
            <Link href="/kits" className={itemClass} onClick={onClose}>
              <IconRayo className="h-5 w-5 shrink-0 text-amber-500" />
              Kits y Ensambles
            </Link>
          )}

          {mostrarRecepcionEnMas && puedeVerRecepciones && (
            <Link href="/recepciones" className={itemClass} onClick={onClose}>
              <IconRecepcion className="h-5 w-5 shrink-0" />
              Recepción
            </Link>
          )}

          {puedeVerInventario && (
            <Link href="/inventario" className={itemClass} onClick={onClose}>
              <IconPaquete className="h-5 w-5 shrink-0" />
              Inventario en obra
            </Link>
          )}

          {puedeVerTraspasos && traspasosDisponibles && (
            <Link href="/traspasos" className={itemClass} onClick={onClose}>
              <IconTraspasos className="h-5 w-5 shrink-0" />
              Traspasos
            </Link>
          )}

          {mostrarOrdenesEnMas && puedeVerPrecios && (
            <Link href="/ordenes" className={itemClass} onClick={onClose}>
              <IconOrdenes className="h-5 w-5 shrink-0" />
              Órdenes
            </Link>
          )}

          {puedeGestionarProveedores && (
            <Link href="/proveedores" className={itemClass} onClick={onClose}>
              <IconProveedores className="h-5 w-5 shrink-0" />
              Proveedores
            </Link>
          )}

          {puedeGestionarUsuarios && (
            <Link href="/usuarios" className={itemClass} onClick={onClose}>
              <IconUsuarios className="h-5 w-5 shrink-0" />
              Usuarios
            </Link>
          )}

          {puedeVerBitacora && (
            <Link href="/bitacora" className={itemClass} onClick={onClose}>
              <IconBitacora className="h-5 w-5 shrink-0" />
              Bitácora
            </Link>
          )}

          {vistaCampoLimitada && (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              En campo ves el estatus de tus requisiciones, la recepción y el
              inventario por instalar.
            </p>
          )}
        </nav>

        <form action={logoutAction} className="mt-4 border-t border-border pt-3">
          <button
            type="submit"
            className="flex min-h-[48px] w-full items-center gap-3 rounded-lg px-3 text-left text-base font-semibold text-danger hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
          >
            <IconSalir className="h-5 w-5 shrink-0" />
            Salir
          </button>
        </form>
      </div>
    </div>
  )
}
