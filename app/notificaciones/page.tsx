import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { IconDocumento } from '@/components/icons'
import { NotificacionAcciones } from '@/components/NotificacionAcciones'
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
  const supabase = await createClient()

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
      <PageHeader
        title="Avisos"
        description="Lo que te espera: requisiciones, recepciones y traspasos."
      />

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
                  <Badge variant="teal">
                    Nuevo
                  </Badge>
                )}
              </div>
              <NotificacionAcciones id={n.id} href={href} leida={n.leida} />
            </article>
          )
        })}

        {items.length === 0 && !error && (
          <EmptyState
            icon={IconDocumento}
            title="No hay avisos todavía"
            description="Cuando haya requisiciones, recepciones o traspasos que requieran tu atención, aparecerán aquí."
          />
        )}
      </div>
    </main>
  )
}
