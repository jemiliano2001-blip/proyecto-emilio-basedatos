'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { IconCampana } from '@/components/icons'
import { contarNoLeidasAction } from '@/lib/actions/notificaciones'
import { createClient } from '@/lib/supabase/client'

export function NotificacionCampanita() {
  const [noLeidas, setNoLeidas] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function cargar() {
      const res = await contarNoLeidasAction()
      if (!cancelled && !res.error) setNoLeidas(res.noLeidas)
    }

    void cargar()

    const supabase = createClient()
    const channel = supabase
      .channel('notificaciones-badge')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notificaciones' },
        () => {
          void cargar()
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [])

  const label =
    noLeidas > 0 ? `Avisos, ${noLeidas} sin leer` : 'Avisos'

  return (
    <Link
      href="/notificaciones"
      className="relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={label}
    >
      <IconCampana className="h-6 w-6" />
      {noLeidas > 0 && (
        <span className="absolute right-1 top-1 min-w-[1.125rem] rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-4 text-primary-foreground">
          {noLeidas > 99 ? '99+' : noLeidas}
        </span>
      )}
    </Link>
  )
}
