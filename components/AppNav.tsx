'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { MoreSheet } from '@/components/MoreSheet'
import {
  IconMas,
  IconOrdenes,
  IconPaquete,
  IconProyectos,
  IconRecepcion,
  IconSolicitudes,
} from '@/components/icons'
import type { RolUsuario } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  esVistaCampoLimitada,
  puedeVerInventarioCampo,
  puedeVerNavProyectos,
} from '@/lib/roles'

function linkClass(active: boolean): string {
  return cn(
    'flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-semibold sm:text-xs transition-colors',
    active ? 'text-ink font-bold' : 'text-gray-500 hover:text-ink/80'
  )
}

export function AppNav({
  rol,
  puedeVerPrecios,
  puedeVerRecepciones,
  puedeVerTraspasos,
  puedeGestionarProveedores,
  traspasosDisponibles,
}: {
  rol: RolUsuario | null
  puedeVerPrecios: boolean
  puedeVerRecepciones: boolean
  puedeVerTraspasos: boolean
  puedeGestionarProveedores: boolean
  traspasosDisponibles: boolean
}) {
  const pathname = usePathname()
  const [masAbierto, setMasAbierto] = useState(false)

  const mostrarProyectos = puedeVerNavProyectos(rol)
  const vistaCampo = esVistaCampoLimitada(rol)
  const mostrarInventario = puedeVerInventarioCampo(rol)

  const enProyectos = pathname === '/' || pathname.startsWith('/obras')
  const enSolicitudes = pathname.startsWith('/solicitudes')
  const enRecepcion =
    pathname.startsWith('/recepciones') || pathname.includes('/recibir')
  const enInventario = pathname.startsWith('/inventario')
  const enOrdenes = pathname.startsWith('/ordenes') && !pathname.includes('/recibir')
  const enMas =
    pathname.startsWith('/materiales') ||
    pathname.startsWith('/traspasos') ||
    pathname.startsWith('/proveedores') ||
    pathname.startsWith('/notificaciones') ||
    (!vistaCampo && enInventario) ||
    (rol === 'finanzas' ? enRecepcion : enOrdenes)

  const mostrarRecepcion = puedeVerRecepciones && rol !== 'finanzas'
  const mostrarOrdenesTab = rol === 'finanzas' && puedeVerPrecios
  const mostrarInventarioTab = vistaCampo && mostrarInventario
  const mostrarInventarioEnMas = mostrarInventario && !mostrarInventarioTab

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-20 md:hidden border-t border-gray-200/80 bg-white/95 backdrop-blur-md"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Principal"
      >
        <div className="mx-auto flex max-w-2xl items-stretch gap-1 px-1">
          {mostrarProyectos && (
            <Link
              href="/"
              className={linkClass(enProyectos)}
              aria-current={enProyectos ? 'page' : undefined}
            >
              <IconProyectos className="h-5 w-5" />
              Proyectos
            </Link>
          )}
          <Link
            href="/solicitudes"
            className={linkClass(enSolicitudes)}
            aria-current={enSolicitudes ? 'page' : undefined}
          >
            <IconSolicitudes className="h-5 w-5" />
            Solicitudes
          </Link>
          {mostrarRecepcion && (
            <Link
              href="/recepciones"
              className={linkClass(enRecepcion)}
              aria-current={enRecepcion ? 'page' : undefined}
            >
              <IconRecepcion className="h-5 w-5" />
              Recepción
            </Link>
          )}
          {mostrarInventarioTab && (
            <Link
              href="/inventario"
              className={linkClass(enInventario)}
              aria-current={enInventario ? 'page' : undefined}
            >
              <IconPaquete className="h-5 w-5" />
              Inventario
            </Link>
          )}
          {mostrarOrdenesTab && (
            <Link
              href="/ordenes"
              className={linkClass(enOrdenes)}
              aria-current={enOrdenes ? 'page' : undefined}
            >
              <IconOrdenes className="h-5 w-5" />
              Órdenes
            </Link>
          )}
          <button
            type="button"
            className={linkClass(enMas || masAbierto)}
            aria-expanded={masAbierto}
            aria-haspopup="dialog"
            aria-controls="mas-sheet"
            onClick={() => setMasAbierto(true)}
          >
            <IconMas className="h-5 w-5" />
            Más
          </button>
        </div>
      </nav>
      <MoreSheet
        open={masAbierto}
        onClose={() => setMasAbierto(false)}
        puedeVerPrecios={puedeVerPrecios}
        puedeVerTraspasos={puedeVerTraspasos && !vistaCampo}
        puedeGestionarProveedores={puedeGestionarProveedores && !vistaCampo}
        puedeVerRecepciones={puedeVerRecepciones}
        mostrarOrdenesEnMas={!mostrarOrdenesTab && !vistaCampo}
        mostrarRecepcionEnMas={!mostrarRecepcion}
        traspasosDisponibles={traspasosDisponibles && !vistaCampo}
        vistaCampoLimitada={vistaCampo}
        puedeVerInventario={mostrarInventarioEnMas}
      />
    </>
  )
}
