import * as React from 'react'
import { cn } from '@/lib/utils'

export interface BentoFeatureGridProps {
  className?: string
}

export function BentoFeatureGrid({ className }: BentoFeatureGridProps) {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6', className)}>
      {/* 2x2 Feature Principal: Trazabilidad Dual de Presupuesto */}
      <div className="md:col-span-2 lg:col-span-2 md:row-span-2 rounded-3xl border border-amber-200/70 bg-gradient-to-br from-amber-50/50 via-card to-card p-6 sm:p-8 shadow-card flex flex-col justify-between">
        <div>
          <div className="inline-flex size-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 font-bold mb-4 shadow-xs">
            💰
          </div>
          <span className="inline-block rounded-full bg-amber-200/60 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-stone-800 ml-2">
            Presupuesto Dual
          </span>
          <h3 className="font-heading text-2xl font-bold text-foreground mt-2 leading-tight">
            Control de Presupuesto en Cantidad y Dinero
          </h3>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Cada requisición aprobada por Compras deduce de inmediato el saldo en piezas y reserva el presupuesto financiero en MXN. Cero discrepancias entre lo cotizado y lo facturado.
          </p>
        </div>

        {/* Mini Preview Visual */}
        <div className="mt-6 rounded-2xl border border-amber-200/60 bg-amber-50/30 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-foreground">Saldo Materiales Obra</span>
            <span className="text-emerald-700 font-bold">92% Disponible</span>
          </div>
          <div className="h-2 w-full rounded-full bg-amber-200/60 overflow-hidden">
            <div className="h-full bg-[#0369A1] rounded-full w-[92%]" />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground mt-2">
            <span>Usado: $42,500</span>
            <span>Comprometido: $18,300</span>
            <span className="font-semibold text-foreground">Total: $750,000 MXN</span>
          </div>
        </div>
      </div>

      {/* 2x1 Feature: Aprobación en Cadena */}
      <div className="md:col-span-2 lg:col-span-2 rounded-3xl border border-border/80 bg-card p-6 sm:p-7 shadow-card flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="inline-flex size-10 items-center justify-center rounded-2xl bg-sky-100 text-[#0369A1] font-bold">
              ✓
            </div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Cadena de Autorizaciones
            </span>
          </div>
          <h4 className="font-heading text-xl font-bold text-foreground">
            Aprobación Fluida: Personal → Compras → Finanzas
          </h4>
          <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Flujo estandarizado con estatus claros (recibida, en_proceso, finalizada) y emisión automática de Órdenes de Compra con formato PDF / Excel profesional.
          </p>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs font-medium">
          <span className="rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1">
            Talía (Compras)
          </span>
          <span className="text-muted-foreground">→</span>
          <span className="rounded-xl bg-sky-50 text-sky-800 border border-sky-200 px-3 py-1">
            Blanquita (Finanzas)
          </span>
          <span className="text-muted-foreground">→</span>
          <span className="rounded-xl bg-purple-50 text-purple-800 border border-purple-200 px-3 py-1">
            Emilio (Acceso Total)
          </span>
        </div>
      </div>

      {/* 1x1 Feature: Captura en Obra */}
      <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-card flex flex-col justify-between">
        <div>
          <div className="inline-flex size-10 items-center justify-center rounded-2xl bg-teal-100 text-teal-800 font-bold mb-3">
            📸
          </div>
          <h4 className="font-heading text-lg font-bold text-foreground leading-snug">
            Recepción Móvil & Evidencia Fotográfica
          </h4>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            Personal en campo registra remisiones y fotos con touch targets de 44px táctiles.
          </p>
        </div>
        <span className="mt-4 inline-block text-[11px] font-bold text-[#0F766E]">
          Touch Ergonómico ≥44px →
        </span>
      </div>

      {/* 1x1 Feature: Resiliencia Offline */}
      <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-card flex flex-col justify-between">
        <div>
          <div className="inline-flex size-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 font-bold mb-3">
            ⚡
          </div>
          <h4 className="font-heading text-lg font-bold text-foreground leading-snug">
            Modo Fuera de Línea
          </h4>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            Service worker y cola IndexedDB para trabajar sin señal celular en zonas remotas de obra.
          </p>
        </div>
        <span className="mt-4 inline-block text-[11px] font-bold text-amber-800">
          Sincronización Automática →
        </span>
      </div>
    </div>
  )
}
