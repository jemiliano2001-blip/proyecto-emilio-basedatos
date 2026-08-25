import Link from 'next/link'
import {
  abrirNotificacionAction,
  marcarNotificacionLeidaFormAction,
} from '@/lib/actions/notificaciones'
import { getSessionUsuario } from '@/lib/auth/session'
import { hrefNotificacion } from '@/lib/nav'
import { createClient } from '@/lib/supabase/server'
import type { Notificacion } from '@/lib/types'

function fechaAviso(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
}

export default async function NotificacionesPage() {
  const session = await getSessionUsuario()
  const supabase = createClient()

  const { data, error } = session?.perfil
    ? await supabase
        .from('notificaciones')
        .select(
          'id, usuario_id, rol_destino, titulo, mensaje, tipo, referencia_id, leida, creado_en'
        )
        .order('creado_en', { ascending: false })
        .limit(80)
    : { data: null, error: { message: 'No autenticado' } }

  const items = (data ?? []) as Notificacion[]

  return (
    <main className="page-shell">
      <header className="mb-6 pt-2">
        <h1 className="text-2xl font-bold text-ink">Avisos</h1>
        <p className="text-sm text-gray-500">
          Lo que te espera: requisiciones, recepciones y traspasos.
        </p>
      </header>

      {error && (
        <div className="card mb-4 border-red-300 bg-red-50 text-red-700">
          No se pudieron cargar los avisos. Revisa tu conexión.
        </div>
      )}

      <div className="space-y-2">
        {items.map((n) => {
          const href = hrefNotificacion(n.tipo, n.referencia_id)
          return (
            <article
              key={n.id}
              className={`card ${n.leida ? 'opacity-70' : 'border-accent/30'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{n.titulo}</p>
                  <p className="mt-1 text-sm text-gray-600">{n.mensaje}</p>
                  <p className="mt-2 text-xs text-gray-400">{fechaAviso(n.creado_en)}</p>
                </div>
                {!n.leida && (
                  <span className="mt-1 shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Nuevo
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {href && (
                  <form action={abrirNotificacionAction.bind(null, n.id, href)}>
                    <button type="submit" className="btn-primary text-sm py-2 px-4">
                      Ver
                    </button>
                  </form>
                )}
                {!n.leida && (
                  <form action={marcarNotificacionLeidaFormAction.bind(null, n.id)}>
                    <button type="submit" className="btn-secondary text-sm py-2 px-4">
                      Marcar leído
                    </button>
                  </form>
                )}
              </div>
            </article>
          )
        })}

        {items.length === 0 && !error && (
          <p className="py-8 text-center text-gray-500">No hay avisos todavía.</p>
        )}
      </div>
    </main>
  )
}
