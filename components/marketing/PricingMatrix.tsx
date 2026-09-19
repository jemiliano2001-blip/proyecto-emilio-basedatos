'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface PricingPlan {
  id: string
  name: string
  description: string
  priceMonthly: number
  priceAnnual: number
  popular?: boolean
  features: string[]
  ctaText: string
  variant?: 'default' | 'support' | 'secondary'
}

const DEFAULT_PLANS: PricingPlan[] = [
  {
    id: 'campo',
    name: 'Operación en Campo',
    description: 'Para supervisores y residentes de obra que capturan recepciones e inventario.',
    priceMonthly: 850,
    priceAnnual: 720,
    features: [
      'Captura de remisiones y fotos en obra',
      'Modo Offline resiliente (IndexedDB)',
      'Escaneo QR de Órdenes de Compra',
      'Protección de precios y confidencialidad',
      'Hasta 5 proyectos simultáneos',
    ],
    ctaText: 'Comenzar en Obra',
    variant: 'secondary',
  },
  {
    id: 'pro',
    name: 'Gestión & Compras Pro',
    description: 'Para equipos de compras, cotizaciones y control financiero integral.',
    priceMonthly: 1950,
    priceAnnual: 1650,
    popular: true,
    features: [
      'Todo lo del plan Campo',
      'Cadena de aprobación (Compras → Finanzas)',
      'Control de saldo en piezas y dinero (MXN)',
      'Emisión formal de OC en PDF y Excel',
      'Extracción inteligente de CFDI 4.0 XML',
      'Proyectos y materiales ilimitados',
    ],
    ctaText: 'Seleccionar Plan Pro',
    variant: 'default',
  },
  {
    id: 'total',
    name: 'Empresa & Acceso Total',
    description: 'Para directores generales y auditoría completa con múltiples contratistas.',
    priceMonthly: 3600,
    priceAnnual: 3100,
    features: [
      'Todo lo del plan Pro',
      'Bitácora de auditoría inmutable',
      'Administración granular de usuarios y roles',
      'Exportación avanzada de conciliaciones de cierre',
      'Soporte prioritario y capacitación dedicada',
      'Garantía de disponibilidad 99.9%',
    ],
    ctaText: 'Hablar con un Asesor',
    variant: 'support',
  },
]

export function PricingMatrix({ className }: { className?: string }) {
  const [billingCycle, setBillingCycle] = React.useState<'monthly' | 'annual'>('annual')

  return (
    <div className={cn('flex flex-col items-center w-full', className)}>
      {/* Selector Mensual / Anual */}
      <div className="flex items-center gap-3 rounded-full border border-amber-200/80 bg-amber-50/70 p-1.5 shadow-xs mb-10">
        <button
          type="button"
          onClick={() => setBillingCycle('monthly')}
          className={cn(
            'px-5 py-2 text-xs font-semibold rounded-full transition-all duration-200 cursor-pointer',
            billingCycle === 'monthly'
              ? 'bg-card text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Facturación Mensual
        </button>

        <button
          type="button"
          onClick={() => setBillingCycle('annual')}
          className={cn(
            'flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-full transition-all duration-200 cursor-pointer',
            billingCycle === 'annual'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <span>Facturación Anual</span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
              billingCycle === 'annual' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
            )}
          >
            Ahorra 15%
          </span>
        </button>
      </div>

      {/* Grid de Planes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl">
        {DEFAULT_PLANS.map((plan) => {
          const price = billingCycle === 'annual' ? plan.priceAnnual : plan.priceMonthly

          return (
            <div
              key={plan.id}
              className={cn(
                'relative flex flex-col justify-between rounded-3xl border p-6 sm:p-8 transition-all duration-200',
                plan.popular
                  ? 'border-primary bg-card shadow-elevated ring-2 ring-primary/20 scale-[1.02]'
                  : 'border-border/80 bg-card/80 shadow-card hover:border-amber-200 hover:shadow-md'
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3.5 py-0.5 text-xs font-bold text-primary-foreground shadow-sm uppercase tracking-wider">
                  Más Recomendado
                </div>
              )}

              <div>
                <h3 className="font-heading text-xl font-bold text-foreground">{plan.name}</h3>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed min-h-[36px]">
                  {plan.description}
                </p>

                <div className="mt-6 flex items-baseline gap-1 border-b border-border/60 pb-6">
                  <span className="font-heading text-4xl font-extrabold text-foreground tabular-nums">
                    ${price.toLocaleString('es-MX')}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">MXN / mes</span>
                </div>

                <ul className="mt-6 space-y-3 text-xs text-foreground font-medium">
                  {plan.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold mt-0.5">
                        ✓
                      </span>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t border-border/40">
                <Button
                  className="w-full"
                  variant={plan.variant || (plan.popular ? 'default' : 'secondary')}
                >
                  {plan.ctaText}
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
