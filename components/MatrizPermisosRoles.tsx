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
    colorBadge: 'bg-primary-soft text-primary border-primary/25',
    resumen: 'Interfaz ligera y enfocada en campo: captura de requisiciones y recepción física de suministros.',
    loQueVe: [
      'Sus requisiciones levantadas y el estatus en que se encuentran.',
      'Checklist y detalle de materiales a recibir cuando llega un pedido.',
      'Inventario físico de materiales recibidos en sus proyectos asignados.',
    ],
    loQueHace: [
      'Levantar requisiciones de materiales para el proyecto activo.',
      'Registrar la recepción de material en obra (subir fotos de remisión y piezas).',
      'Reportar instalaciones de material ejecutadas en campo.',
      'Solicitar traspasos entre sus proyectos asignados y confirmar su recepción en un destino asignado.',
    ],
    restricciones: [
      'No tiene acceso a precios unitarios, montos de dinero ni presupuestos MXN.',
      'No puede aprobar compras ni emitir órdenes de compra.',
      'Solo visualiza los proyectos que Emilio le asignó desde Usuarios.',
    ],
  },
  proyectos: {
    rol: 'proyectos',
    etiqueta: 'Proyectos y Supervisión',
    responsableEjemplo: 'Manuel',
    colorBadge: 'bg-secondary-soft text-secondary border-secondary/25',
    resumen: 'Planificación técnica: asignación de materiales, supervisión de saldos y catálogo de kits.',
    loQueVe: [
      'Todos los proyectos (activos, pausados y cerrados).',
      'Presupuesto contratado de materiales (cantidades y costo referencial).',
      'Saldos disponibles por obra: Usado, Comprometido y Disponible.',
      'Catálogo de materiales agrupados (Obra Civil / Electromecánico) y kits.',
      'Documentación técnica y planos adjuntos a los proyectos.',
    ],
    loQueHace: [
      'Asignar presupuestos de materiales individuales y ensambles/kits.',
      'Administrar el catálogo de materiales y kits de ensamble.',
      'Solicitar, aprobar o cancelar traspasos de material entre obras.',
      'Subir y consultar documentos técnicos de las obras.',
    ],
    restricciones: [
      'Crear y editar proyectos corresponde a Operación y Acceso Total.',
      'No autoriza pagos de dinero ni emite órdenes de compra a proveedores.',
      'No administra usuarios ni permisos del sistema.',
    ],
  },
  compras: {
    rol: 'compras',
    etiqueta: 'Compras y Cotizaciones',
    responsableEjemplo: 'Talía',
    colorBadge: 'bg-warning-soft text-warning-soft-foreground border-warning/30',
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
    colorBadge: 'bg-primary-soft text-primary border-primary/25',
    resumen: 'Control logístico global: supervisión de movimientos, traspasos y auditoría de eventos.',
    loQueVe: [
      'Todos los proyectos, compras, recepciones e inventario.',
      'Bitácora de auditoría completa (registro de quién creó, editó o eliminó registros).',
      'Saldos y movimientos de materiales en todas las obras.',
    ],
    loQueHace: [
      'Crear y editar proyectos, clientes y fraccionamientos.',
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
    colorBadge: 'bg-success-soft text-success-soft-foreground border-success/25',
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
    colorBadge: 'bg-primary text-primary-foreground border-primary shadow-xs',
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
    <div className="card space-y-4 border-border/80 bg-card p-5 sm:p-6 shadow-card">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-bold font-heading text-foreground tracking-tight">
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
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all select-none ${
                seleccionado
                  ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {etiquetaRol(rol)}
            </button>
          )
        })}
      </div>

      {/* Ficha detallada del rol seleccionado */}
      <div className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className={`inline-block rounded-lg px-2.5 py-0.5 text-xs font-bold border ${info.colorBadge}`}>
              {info.etiqueta}
            </span>
            <span className="text-xs text-muted-foreground">
              Referencia: <strong className="text-foreground">{info.responsableEjemplo}</strong>
            </span>
          </div>
        </div>

        <p className="text-xs text-foreground/90 leading-relaxed font-medium bg-muted/40 p-3 rounded-xl border border-border/50">
          {info.resumen}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
          {/* Lo que ve */}
          <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-2 shadow-xs">
            <p className="text-xs font-bold text-foreground flex items-center gap-2">
              <span className="inline-block size-2 rounded-full bg-primary" />
              Lo que ve
            </p>
            <ul className="text-xs text-muted-foreground space-y-1.5 pl-3 list-disc leading-relaxed">
              {info.loQueVe.map((item, idx) => (
                <li key={idx} className="leading-snug">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Lo que hace */}
          <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-2 shadow-xs">
            <p className="text-xs font-bold text-foreground flex items-center gap-2">
              <span className="inline-block size-2 rounded-full bg-secondary" />
              Lo que puede hacer
            </p>
            <ul className="text-xs text-muted-foreground space-y-1.5 pl-3 list-disc leading-relaxed">
              {info.loQueHace.map((item, idx) => (
                <li key={idx} className="leading-snug">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Restricciones */}
          <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-2 shadow-xs">
            <p className="text-xs font-bold text-foreground flex items-center gap-2">
              <span className="inline-block size-2 rounded-full bg-warning" />
              Restricciones clave
            </p>
            <ul className="text-xs text-muted-foreground space-y-1.5 pl-3 list-disc leading-relaxed">
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
