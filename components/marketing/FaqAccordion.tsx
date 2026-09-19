'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface FaqItem {
  question: string
  answer: string
}

const DEFAULT_FAQS: FaqItem[] = [
  {
    question: '¿Cómo funciona la deducción automática del presupuesto?',
    answer:
      'Al crear una requisición de material para una obra, el sistema valida que exista saldo disponible tanto en piezas contratadas como en presupuesto monetario (MXN). Cuando Compras aprueba la requisición, el monto se reserva provisionalmente; una vez que Finanzas emite la Orden de Compra y se registra la factura, el gasto queda formalmente comprometido y deducido.',
  },
  {
    question: '¿Por qué los supervisores de campo no pueden ver precios?',
    answer:
      'Por diseño de seguridad y gobernanza operativa (Least Privilege), el rol "personal" tiene restringido el acceso visual a importes monetarios y costos unitarios. Solo interactúan con cantidades físicas, especificaciones técnicas y estados de recepción en obra, protegiendo información financiera confidencial.',
  },
  {
    question: '¿Qué sucede si un supervisor captura recepciones sin conexión a internet?',
    answer:
      'ObraTrack opera con resiliencia offline basada en Service Worker y colas locales en IndexedDB. El residente puede capturar remisiones y evidencias fotográficas sin señal; en cuanto el dispositivo detecta conexión de datos, las transacciones se envían automáticamente al servidor de forma segura e idempotente.',
  },
  {
    question: '¿Cómo cumple el sistema con la accesibilidad WCAG AAA y el estilo 2026?',
    answer:
      'Siguiendo la especificación Cálido & Orgánico (El Cuidador), toda la tipografía base mantiene contrastes superiores a 7:1 contra su fondo, con tamaños mínimos de 16px para lectura descansada, titulares humanistas en Playfair Display, y un radio de bordes consistente de 16px que elimina aristas agresivas.',
  },
]

export function FaqAccordion({
  items = DEFAULT_FAQS,
  className,
}: {
  items?: FaqItem[]
  className?: string
}) {
  const [openIndexes, setOpenIndexes] = React.useState<Set<number>>(new Set([0]))

  const toggle = (index: number) => {
    setOpenIndexes((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  return (
    <div className={cn('w-full max-w-3xl space-y-3.5', className)}>
      {items.map((item, index) => {
        const isOpen = openIndexes.has(index)

        return (
          <div
            key={index}
            className={cn(
              'rounded-2xl border transition-all duration-200 overflow-hidden',
              isOpen
                ? 'border-amber-200/80 bg-amber-50/40 shadow-sm'
                : 'border-border/80 bg-card hover:border-amber-200/50'
            )}
          >
            <button
              type="button"
              onClick={() => toggle(index)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 p-5 text-left font-semibold text-foreground transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl"
            >
              <span className="font-heading text-base sm:text-lg">{item.question}</span>
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground transition-transform duration-200',
                  isOpen && 'rotate-180 text-primary bg-primary-soft'
                )}
                aria-hidden="true"
              >
                <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </button>

            {isOpen && (
              <div className="px-5 pb-5 pt-1 text-sm text-muted-foreground leading-relaxed animate-fade-in">
                {item.answer}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
