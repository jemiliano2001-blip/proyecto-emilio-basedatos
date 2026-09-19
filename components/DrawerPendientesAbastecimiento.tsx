'use client'

import React, { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { LeadTimeBadge } from '@/components/LeadTimeBadge'
import { IconCerrar } from '@/components/icons'
import { cn } from '@/lib/utils'
import { vibrarTap } from '@/lib/haptics'

interface SolicitudItem {
  id: string
  estado: string
  nota: string | null
  creado_en: string
  obra: { id: string; nombre: string; fraccionamiento: string | null } | null
  solicitante: { nombre: string } | null
}

interface OrdenItem {
  id: string
  folio: string
  folio_fisico: string | null
  total: number
  moneda: string
  estado: string
  creado_en: string
  obra: { id: string; nombre: string; fraccionamiento: string | null } | null
  proveedor: { nombre: string } | null
}

interface AbastecimientoData {
  solicitudesCompras: SolicitudItem[]
  solicitudesFinanzas: SolicitudItem[]
  ordenesTransito: OrdenItem[]
  resumen: {
    totalCompras: number
    totalFinanzas: number
    totalTransito: number
    totalGlobal: number
  }
}

type TabType = 'compras' | 'finanzas' | 'transito'

export function DrawerPendientesAbastecimiento() {
  const [abierto, setAbierto] = useState(false)
  const [tabActiva, setTabActiva] = useState<TabType>('compras')
  const [cargando, setCargando] = useState(false)
  const [datos, setDatos] = useState<AbastecimientoData | null>(null)
  const [filtroTexto, setFiltroTexto] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)

  // Escuchar evento global para abrir el drawer
  useEffect(() => {
    const handleOpen = () => {
      vibrarTap()
      setAbierto(true)
    }
    window.addEventListener('open-abastecimiento-drawer', handleOpen)
    return () => window.removeEventListener('open-abastecimiento-drawer', handleOpen)
  }, [])

  // Cargar datos al abrir
  useEffect(() => {
    if (!abierto) return

    let cancelado = false
    setCargando(true)

    fetch('/api/abastecimiento/pendientes')
      .then((res) => (res.ok ? res.json() : null))
      .then((resJson: AbastecimientoData | null) => {
        if (!cancelado && resJson) {
          setDatos(resJson)
        }
      })
      .catch((err) => console.error('Error cargando abastecimiento:', err))
      .finally(() => {
        if (!cancelado) setCargando(false)
      })

    return () => {
      cancelado = true
    }
  }, [abierto])

  // Manejo de tecla Escape
  useEffect(() => {
    if (!abierto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [abierto])

  if (!abierto) return null

  const filtrado = (texto: string) => {
    if (!filtroTexto.trim()) return true
    return texto.toLowerCase().includes(filtroTexto.toLowerCase())
  }

  const solicitudesComprasFiltradas = (datos?.solicitudesCompras ?? []).filter(
    (s) => filtrado(s.obra?.nombre ?? '') || filtrado(s.solicitante?.nombre ?? '')
  )

  const solicitudesFinanzasFiltradas = (datos?.solicitudesFinanzas ?? []).filter(
    (s) => filtrado(s.obra?.nombre ?? '') || filtrado(s.solicitante?.nombre ?? '')
  )

  const ordenesTransitoFiltradas = (datos?.ordenesTransito ?? []).filter(
    (o) =>
      filtrado(o.folio) ||
      filtrado(o.obra?.nombre ?? '') ||
      filtrado(o.proveedor?.nombre ?? '')
  )

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      aria-modal="true"
      role="dialog"
      aria-labelledby="drawer-abastecimiento-title"
    >
      {/* Backdrop clickeable */}
      <div
        className="fixed inset-0"
        onClick={() => setAbierto(false)}
        aria-hidden="true"
      />

      {/* Contenedor Slide-Over */}
      <div
        ref={panelRef}
        className="relative z-10 flex h-full w-full max-w-md flex-col bg-background shadow-2xl border-l border-border transition-transform animate-in slide-in-from-right duration-300 sm:max-w-lg"
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-card/80">
          <div>
            <h2
              id="drawer-abastecimiento-title"
              className="text-base font-bold text-foreground"
            >
              Control de Abastecimiento
            </h2>
            <p className="text-xs text-muted-foreground">
              Cadena de suministro en tiempo real
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Cerrar cajón"
          >
            <IconCerrar className="size-5" />
          </button>
        </div>

        {/* Pestañas / Tabs */}
        <div className="grid grid-cols-3 border-b border-border bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => setTabActiva('compras')}
            className={cn(
              'flex flex-col items-center justify-center rounded-md py-2 px-1 text-xs font-medium transition-all',
              tabActiva === 'compras'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span>Por Cotizar</span>
            <span
              className={cn(
                'mt-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                (datos?.resumen.totalCompras ?? 0) > 0
                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {datos?.resumen.totalCompras ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTabActiva('finanzas')}
            className={cn(
              'flex flex-col items-center justify-center rounded-md py-2 px-1 text-xs font-medium transition-all',
              tabActiva === 'finanzas'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span>Por Autorizar</span>
            <span
              className={cn(
                'mt-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                (datos?.resumen.totalFinanzas ?? 0) > 0
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {datos?.resumen.totalFinanzas ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTabActiva('transito')}
            className={cn(
              'flex flex-col items-center justify-center rounded-md py-2 px-1 text-xs font-medium transition-all',
              tabActiva === 'transito'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span>En Tránsito</span>
            <span
              className={cn(
                'mt-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                (datos?.resumen.totalTransito ?? 0) > 0
                  ? 'bg-teal-500/20 text-teal-700 dark:text-teal-300'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {datos?.resumen.totalTransito ?? 0}
            </span>
          </button>
        </div>

        {/* Buscador interno */}
        <div className="border-b border-border p-3">
          <input
            type="text"
            placeholder="Filtrar por proyecto, proveedor o folio..."
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {/* Lista de Registros */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cargando ? (
            <div className="py-12 text-center text-sm text-muted-foreground animate-pulse">
              Cargando pendientes de abastecimiento...
            </div>
          ) : null}

          {/* TAB 1: COMPRAS */}
          {!cargando && tabActiva === 'compras' && (
            <>
              {solicitudesComprasFiltradas.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  No hay requisiciones pendientes por cotizar o compras al día.
                </div>
              ) : (
                solicitudesComprasFiltradas.map((req) => (
                  <Link
                    key={req.id}
                    href={`/solicitudes/${req.id}`}
                    onClick={() => setAbierto(false)}
                    className="block rounded-lg border border-border bg-card p-3 shadow-2xs hover:border-primary/50 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground">
                        {req.obra?.nombre ?? 'Proyecto'}
                      </p>
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                        Recibida
                      </span>
                    </div>
                    {req.solicitante && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Solicita: {req.solicitante.nombre}
                      </p>
                    )}
                    {req.nota && (
                      <p className="mt-1 text-[11px] italic text-muted-foreground/80 line-clamp-1">
                        &ldquo;{req.nota}&rdquo;
                      </p>
                    )}
                    <p className="mt-1.5 text-[10px] text-muted-foreground/70">
                      {new Date(req.creado_en).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </Link>
                ))
              )}
            </>
          )}

          {/* TAB 2: FINANZAS */}
          {!cargando && tabActiva === 'finanzas' && (
            <>
              {solicitudesFinanzasFiltradas.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  No hay requisiciones esperando autorización o pago en finanzas.
                </div>
              ) : (
                solicitudesFinanzasFiltradas.map((req) => (
                  <Link
                    key={req.id}
                    href={`/solicitudes/${req.id}`}
                    onClick={() => setAbierto(false)}
                    className="block rounded-lg border border-border bg-card p-3 shadow-2xs hover:border-primary/50 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground">
                        {req.obra?.nombre ?? 'Proyecto'}
                      </p>
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                        En Proceso
                      </span>
                    </div>
                    {req.solicitante && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Solicita: {req.solicitante.nombre}
                      </p>
                    )}
                    <p className="mt-1.5 text-[10px] text-muted-foreground/70">
                      {new Date(req.creado_en).toLocaleDateString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </Link>
                ))
              )}
            </>
          )}

          {/* TAB 3: TRÁNSITO */}
          {!cargando && tabActiva === 'transito' && (
            <>
              {ordenesTransitoFiltradas.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  No hay órdenes de compra activas en tránsito de entrega.
                </div>
              ) : (
                ordenesTransitoFiltradas.map((ord) => (
                  <Link
                    key={ord.id}
                    href={`/ordenes/${ord.id}`}
                    onClick={() => setAbierto(false)}
                    className="block rounded-lg border border-border bg-card p-3 shadow-2xs hover:border-teal-500/50 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-foreground">
                        {ord.folio}
                      </p>
                      <LeadTimeBadge fechaEmision={ord.creado_en} />
                    </div>
                    <p className="mt-1 text-xs font-medium text-foreground/90">
                      {ord.obra?.nombre ?? 'Proyecto'}
                    </p>
                    {ord.proveedor && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Prov: {ord.proveedor.nombre}
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Total: ${ord.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })} {ord.moneda}</span>
                      <span className="text-[10px]">
                        {new Date(ord.creado_en).toLocaleDateString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </>
          )}
        </div>

        {/* Pie del Cajón con Atajos */}
        <div className="border-t border-border p-3 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
          <Link
            href="/solicitudes"
            onClick={() => setAbierto(false)}
            className="hover:text-foreground font-medium underline"
          >
            Ver todas las solicitudes
          </Link>
          <Link
            href="/ordenes"
            onClick={() => setAbierto(false)}
            className="hover:text-foreground font-medium underline"
          >
            Ver todas las órdenes
          </Link>
        </div>
      </div>
    </div>
  )
}
