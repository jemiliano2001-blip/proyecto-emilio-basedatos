'use client'

import { useState } from 'react'
import type { RolUsuario } from '@/lib/types'
import { ROLES_USUARIO, etiquetaRol } from '@/lib/validations/usuarios'

interface InfoRol {
  rol: RolUsuario
  etiqueta: string
  responsableEjemplo: string
  colorBadge: string
  resumen: string
  loQueVe: string[]
  loQueHace: string[]
  restricciones: string[]
}

export const GUIA_ROLES: Record<RolUsuario, InfoRol> = {
  personal: {
    rol: 'personal',
    etiqueta: 'Personal en Obra',
    responsableEjemplo: 'Residentes y personal de campo',
    colorBadge: 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/30',
    resumen: 'Interfaz ligera y enfocada en campo: captura de requisiciones y recepción física de suministros.',
    loQueVe: [
      'Sus requisiciones levantadas y el estatus en que se encuentran.',
      'Checklist y detalle de materiales a recibir cuando llega un pedido.',
      'Inventario físico de materiales recibidos en la obra asignada.',
    ],
    loQueHace: [
      'Levantar requisiciones de materiales para el proyecto activo.',
      'Registrar la recepción de material en obra (subir fotos de remisión y piezas).',
      'Reportar instalaciones de material ejecutadas en campo.',
    ],
    restricciones: [
      'No tiene acceso a precios unitarios, montos de dinero ni presupuestos MXN.',
      'No puede aprobar compras ni emitir órdenes de compra.',
      'Solo visualiza el proyecto en el que está trabajando.',
    ],
  },
  proyectos: {
    rol: 'proyectos',
    etiqueta: 'Proyectos y Supervisión',
    responsableEjemplo: 'Manuel',
    colorBadge: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
    resumen: 'Planificación técnica: creación de obras, asignación de presupuestos y catálogo de kits.',
    loQueVe: [
      'Todos los proyectos (activos, pausados y cerrados).',
      'Presupuesto contratado de materiales (cantidades y costo referencial).',
      'Saldos disponibles por obra: Usado, Comprometido y Disponible.',
      'Catálogo de materiales agrupados (Obra Civil / Electromecánico) y kits.',
      'Documentación técnica y planos adjuntos a los proyectos.',
    ],
    loQueHace: [
      'Crear nuevos proyectos y registrar clientes y fraccionamientos.',
      'Asignar presupuestos de materiales individuales y ensambles/kits.',
      'Administrar el catálogo de materiales y kits de ensamble.',
      'Solicitar, aprobar o cancelar traspasos de material entre obras.',
      'Subir y consultar documentos técnicos de las obras.',
    ],
    restricciones: [
      'No autoriza pagos de dinero ni emite órdenes de compra a proveedores.',
      'No administra usuarios ni permisos del sistema.',
    ],
  },
  compras: {
    rol: 'compras',
    etiqueta: 'Compras y Cotizaciones',
    responsableEjemplo: 'Talía',
    colorBadge: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
    resumen: 'Gestión con proveedores: cotización de materiales, ajuste de partidas y preparación de compras.',
    loQueVe: [
      'Todas las solicitudes de compra del equipo en tiempo real.',
      'Saldos disponibles de materiales en cada proyecto para evitar sobrecompras.',
      'Catálogo de proveedores (contacto, teléfono y RFC).',
      'Órdenes de compra generadas y recepciones en campo.',
    ],
    loQueHace: [
      'Revisar y cotizar requisiciones: ajustar cantidades, capturar precios unitarios cotizados y asignar proveedor por partida.',
      'Quitar partidas de la requisición si no proceden o se posponen.',
      'Aprobar solicitudes de compra para turnarlas a pago en Finanzas.',
      'Administrar el catálogo de proveedores.',
      'Revisar cotejos de recepción física contra remisiones.',
    ],
    restricciones: [
      'No libera el pago definitivo de dinero (la autorización final y emisión formal de OC corresponde a Finanzas).',
      'No crea proyectos ni modifica presupuestos base contratados.',
    ],
  },
  operacion: {
    rol: 'operacion',
    etiqueta: 'Operación y Logística',
    responsableEjemplo: 'Iveth',
    colorBadge: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
    resumen: 'Control logístico global: supervisión de movimientos, traspasos y auditoría de eventos.',
    loQueVe: [
      'Todos los proyectos, compras, recepciones e inventario.',
      'Bitácora de auditoría completa (registro de quién creó, editó o eliminó registros).',
      'Saldos y movimientos de materiales en todas las obras.',
    ],
    loQueHace: [
      'Pausar, reactivar y cerrar proyectos con nota de cierre/finiquito.',
      'Coordinar y autorizar traspasos de materiales entre diferentes obras.',
      'Gestionar kits de ensamble y topes de presupuesto.',
      'Consultar la bitácora de auditoría del sistema.',
    ],
    restricciones: [
      'No administra cuentas de usuario ni restablece contraseñas.',
      'No autoriza pagos bancarios ni egresos financieros.',
    ],
  },
  finanzas: {
    rol: 'finanzas',
    etiqueta: 'Finanzas y Tesorería',
    responsableEjemplo: 'Blanquita',
    colorBadge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    resumen: 'Control de egresos: autorización de pago, emisión formal de Órdenes de Compra y facturación.',
    loQueVe: [
      'Solicitudes cotizadas y aprobadas por Compras pendientes de pago.',
      'Presupuesto financiero en dinero (MXN) de cada obra (contratado vs gastado).',
      'Órdenes de compra emitidas y facturas de proveedores asociadas.',
    ],
    loQueHace: [
      'Autorizar el pago de solicitudes: genera automáticamente la Orden de Compra (OC).',
      'Cargar y validar facturas de proveedores vinculadas a las OCs emitidas.',
      'Monitorear el ejercicio presupuestal y egresos por material.',
    ],
    restricciones: [
      'No altera cantidades técnicas en catálogo ni formula especificaciones de obra.',
      'No administra cuentas ni roles de usuarios.',
    ],
  },
  acceso_total: {
    rol: 'acceso_total',
    etiqueta: 'Acceso Total (Dirección)',
    responsableEjemplo: 'Emilio',
    colorBadge: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30',
    resumen: 'Superusuario con control integral de todos los módulos, usuarios, finanzas y auditoría.',
    loQueVe: [
      'Visibilidad 100% de todo el sistema sin restricciones.',
      'Módulo de Administración de Usuarios (/usuarios).',
      'Módulo de Bitácora de Auditoría completa (/bitacora).',
      'Todos los proyectos, compras, OCs, finanzas, inventarios y catálogos.',
    ],
    loQueHace: [
      'Crear y editar usuarios, asignar roles y restablecer contraseñas de acceso.',
      'Aprobar en cualquier etapa (compras, finanzas, traspasos o cancelaciones).',
      'Reabrir obras cerradas y modificar cualquier registro protegido.',
      'Exportar bitácoras y respaldar información del sistema.',
    ],
    restricciones: [
      'Ninguna restricción técnica dentro de la aplicación.',
    ],
  },
}

export function MatrizPermisosRoles({ rolInicial }: { rolInicial?: RolUsuario }) {
  const [rolActivo, setRolActivo] = useState<RolUsuario>(rolInicial ?? 'personal')
  const info = GUIA_ROLES[rolActivo]

  return (
    <div className="card space-y-4 border-border/80 bg-card p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
            Guía de roles y permisos
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Lo que ve y puede realizar cada persona en el sistema.
          </p>
        </div>
      </div>

      {/* Selector de roles en chips horizontales */}
      <div className="flex flex-wrap gap-1.5 border-b border-border/60 pb-3">
        {ROLES_USUARIO.map((rol) => {
          const seleccionado = rol === rolActivo
          return (
            <button
              key={rol}
              type="button"
              onClick={() => setRolActivo(rol)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                seleccionado
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {etiquetaRol(rol)}
            </button>
          )
        })}
      </div>

      {/* Ficha detallada del rol seleccionado */}
      <div className="space-y-3.5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold border ${info.colorBadge}`}>
              {info.etiqueta}
            </span>
            <span className="text-xs text-muted-foreground">
              Referencia: <strong className="text-foreground">{info.responsableEjemplo}</strong>
            </span>
          </div>
        </div>

        <p className="text-xs text-foreground/90 leading-relaxed font-medium bg-muted/40 p-2.5 rounded-lg border border-border/40">
          {info.resumen}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {/* Lo que ve */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1.5">
            <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-teal-500" />
              Lo que ve
            </p>
            <ul className="text-xs text-muted-foreground space-y-1.5 pl-3 list-disc">
              {info.loQueVe.map((item, idx) => (
                <li key={idx} className="leading-snug">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Lo que hace */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1.5">
            <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
              Lo que puede hacer
            </p>
            <ul className="text-xs text-muted-foreground space-y-1.5 pl-3 list-disc">
              {info.loQueHace.map((item, idx) => (
                <li key={idx} className="leading-snug">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Restricciones */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1.5">
            <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
              Restricciones clave
            </p>
            <ul className="text-xs text-muted-foreground space-y-1.5 pl-3 list-disc">
              {info.restricciones.map((item, idx) => (
                <li key={idx} className="leading-snug">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
