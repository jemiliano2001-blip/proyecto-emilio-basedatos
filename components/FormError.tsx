'use client'

import { useEffect, useRef } from 'react'

export function FormError({ message }: { message: string | null | undefined }) {
  const errorRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (message) errorRef.current?.focus()
  }, [message])
  if (!message) return null
  return (
    <div ref={errorRef} tabIndex={-1} className="card border-danger/40 bg-danger-soft text-danger-soft-foreground mb-4 focus:outline-none focus:ring-2 focus:ring-danger" role="alert" aria-live="assertive">
      {message}
    </div>
  )
}
