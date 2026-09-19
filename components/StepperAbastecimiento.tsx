import React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export type EstadoPaso = 'completado' | 'en_proceso' | 'pendiente' | 'rechazado'

export interface PasoAbastecimiento {
  id: string
  titulo: string
  subtitulo?: string | null
  fecha?: string | null
  responsable?: string | null
  estado: EstadoPaso
  enlaceHref?: string | null
  enlaceTexto?: string | null
}

interface StepperAbastecimientoProps {
  pasos: PasoAbastecimiento[]
  className?: string
}

export function StepperAbastecimiento({ pasos, className }: StepperAbastecimientoProps) {
  if (!pasos || pasos.length === 0) return null

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5',
        className
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Ciclo de Abastecimiento
        </h3>
        <span className="text-xs text-muted-foreground">
          {pasos.filter((p) => p.estado === 'completado').length} de {pasos.length} etapas
        </span>
      </div>

      <nav aria-label="Progreso de abastecimiento" className="w-full">
        <ol className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-2">
          {pasos.map((paso, index) => {
            const esUltimo = index === pasos.length - 1

            return (
              <li
                key={paso.id}
                className={cn(
                  'relative flex flex-1 items-start gap-3 sm:flex-col sm:items-center sm:gap-2 sm:text-center'
                )}
              >
                {/* Línea conectora horizontal (desktop) */}
                {!esUltimo && (
                  <div
                    className={cn(
                      'absolute top-4 left-[50%] -z-0 hidden h-0.5 w-full sm:block',
                      paso.estado === 'completado'
                        ? 'bg-teal-600 dark:bg-teal-500'
                        : 'bg-border'
                    )}
                    aria-hidden="true"
                  />
                )}

                {/* Línea conectora vertical (mobile) */}
                {!esUltimo && (
                  <div
                    className={cn(
                      'absolute top-8 left-4 -z-0 h-[calc(100%+8px)] w-0.5 sm:hidden',
                      paso.estado === 'completado'
                        ? 'bg-teal-600 dark:bg-teal-500'
                        : 'bg-border'
                    )}
                    aria-hidden="true"
                  />
                )}

                {/* Indicador circular del paso */}
                <div
                  className={cn(
                    'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all shadow-sm',
                    paso.estado === 'completado' &&
                      'bg-teal-600 text-white shadow-teal-600/20',
                    paso.estado === 'en_proceso' &&
                      'bg-primary text-primary-foreground ring-4 ring-primary/20 animate-pulse',
                    paso.estado === 'pendiente' &&
                      'border-2 border-border bg-background text-muted-foreground',
                    paso.estado === 'rechazado' &&
                      'bg-rose-600 text-white shadow-rose-600/20'
                  )}
                >
                  {paso.estado === 'completado' && (
                    <svg
                      className="size-4 stroke-[3]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {paso.estado === 'en_proceso' && <span>{index + 1}</span>}
                  {paso.estado === 'pendiente' && <span>{index + 1}</span>}
                  {paso.estado === 'rechazado' && (
                    <svg
                      className="size-4 stroke-[3]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>

                {/* Contenido textual */}
                <div className="min-w-0 flex-1 sm:w-full">
                  <div className="flex flex-wrap items-center gap-1.5 sm:justify-center">
                    <p
                      className={cn(
                        'text-xs font-semibold sm:text-sm',
                        paso.estado === 'en_proceso'
                          ? 'text-primary'
                          : paso.estado === 'rechazado'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-foreground'
                      )}
                    >
                      {paso.titulo}
                    </p>
                  </div>

                  {paso.subtitulo && (
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                      {paso.subtitulo}
                    </p>
                  )}

                  {paso.responsable && (
                    <p className="text-[11px] font-medium text-foreground/80">
                      {paso.responsable}
                    </p>
                  )}

                  {paso.fecha && (
                    <p className="text-[11px] text-muted-foreground/80">{paso.fecha}</p>
                  )}

                  {paso.enlaceHref && paso.enlaceTexto && (
                    <div className="mt-1">
                      <Link
                        href={paso.enlaceHref}
                        className="inline-flex items-center gap-0.5 text-[11px] font-medium text-teal-600 hover:underline dark:text-teal-400"
                      >
                        {paso.enlaceTexto}
                        <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </nav>
    </div>
  )
}
