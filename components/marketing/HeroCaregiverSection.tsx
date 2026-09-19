import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface HeroCaregiverSectionProps {
  pillText?: string
  pillHref?: string
  title?: string
  highlightedTitle?: string
  description?: string
  primaryCtaText?: string
  primaryCtaHref?: string
  secondaryCtaText?: string
  secondaryCtaHref?: string
  metrics?: { value: string; label: string }[]
  className?: string
}

export function HeroCaregiverSection({
  pillText = '✨ Sistema de Trazabilidad 2026 — Especificación El Cuidador',
  pillHref = '/sistema-diseno',
  title = 'Control y Trazabilidad Operativa con',
  highlightedTitle = 'Calidez Humana y Rigor Financiero',
  description = 'ObraTrack unifica presupuestos, requisiciones y compras de materiales para proyectos y obras civiles y electromecánicas con accesibilidad universal WCAG AAA y cero fricción visual.',
  primaryCtaText = 'Explorar Sistema de Diseño',
  primaryCtaHref = '/sistema-diseno',
  secondaryCtaText = 'Ver Requisiciones Activas',
  secondaryCtaHref = '/solicitudes',
  metrics = [
    { value: '100%', label: 'Accesibilidad WCAG AAA' },
    { value: '16px', label: 'Radio Ergonómico' },
    { value: '7:1', label: 'Contraste Mínimo' },
    { value: '0ms', label: 'Fricción Operativa' },
  ],
  className,
}: HeroCaregiverSectionProps) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-3xl border border-amber-200/70 bg-gradient-to-b from-amber-50/60 via-amber-50/30 to-background p-6 sm:p-10 lg:p-14 shadow-sm text-center',
        className
      )}
    >
      {/* Halo ambiental suave detrás del hero */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 size-96 rounded-full bg-amber-200/30 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center">
        {/* Anuncio Pill */}
        {pillText && (
          <Link
            href={pillHref}
            className="hero-pill mb-6 transition-all duration-200 hover:border-amber-300 hover:bg-amber-100/90 active:scale-[0.98]"
          >
            <span>{pillText}</span>
            <span className="text-amber-800 font-bold" aria-hidden>
              →
            </span>
          </Link>
        )}

        {/* Titular Principal H1 en Playfair Display */}
        <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground leading-[1.15] max-w-[28ch]">
          {title}{' '}
          <span className="text-[#0369A1] underline decoration-amber-300/80 decoration-wavy decoration-2 underline-offset-4">
            {highlightedTitle}
          </span>
        </h1>

        {/* Descripción con longitud máxima ergonómica */}
        <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-[65ch]">
          {description}
        </p>

        {/* Dual CTA */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
          <Link href={primaryCtaHref}>
            <Button size="lg" className="shadow-md">
              {primaryCtaText}
            </Button>
          </Link>

          <Link href={secondaryCtaHref}>
            <Button size="lg" variant="support" className="shadow-sm">
              {secondaryCtaText}
            </Button>
          </Link>
        </div>

        {/* Micro métricas de confianza */}
        {metrics && metrics.length > 0 && (
          <div className="mt-12 grid w-full grid-cols-2 gap-4 border-t border-amber-200/60 pt-8 sm:grid-cols-4">
            {metrics.map((m, idx) => (
              <div key={idx} className="flex flex-col items-center">
                <span className="font-heading text-2xl font-bold text-foreground tabular-nums">
                  {m.value}
                </span>
                <span className="text-xs text-muted-foreground mt-0.5 font-medium">
                  {m.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
