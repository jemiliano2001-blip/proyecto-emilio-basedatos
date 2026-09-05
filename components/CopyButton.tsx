'use client'

import { useState } from 'react'
import { IconCheck, IconCopy } from '@/components/icons'
import { cn } from '@/lib/utils'

export function CopyButton({
  text,
  label,
  className,
  title = 'Copiar al portapapeles',
}: {
  text: string
  label?: string
  className?: string
  title?: string
}) {
  const [copiado, setCopiado] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      const safeText = text ?? ''
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(safeText)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = safeText
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Fallback silencioso
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copiado ? '¡Copiado!' : title}
      aria-label={copiado ? '¡Copiado!' : title}
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium rounded-md px-1.5 py-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        copiado
          ? 'bg-emerald-50 text-emerald-700 font-semibold'
          : 'text-gray-500 hover:text-ink hover:bg-gray-100',
        className
      )}
    >
      {copiado ? (
        <>
          <IconCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>¡Copiado!</span>
        </>
      ) : (
        <>
          <IconCopy className="h-3.5 w-3.5 text-gray-400" />
          {label && <span>{label}</span>}
        </>
      )}
    </button>
  )
}
