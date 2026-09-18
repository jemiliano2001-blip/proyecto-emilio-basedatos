import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { PageHeader } from '@/components/PageHeader'
import {
  etiquetaAccionAuditoria,
  etiquetaTablaAuditoria,
} from '@/lib/auditoria-labels'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeVerBitacora } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { AuditoriaEvento } from '@/lib/types'

function formatearFecha(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function JsonBlock({
  title,
  value,
}: {
  title: string
  value: Record<string, unknown> | null
}) {
  if (!value) {
    return (
      <div>
        <h3 className="text-sm font-bold text-foreground mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground">—</p>
      </div>
    )
  }

  const entries = Object.entries(value)
  return (
    <div>
      <h3 className="text-sm font-bold text-foreground mb-2">{title}</h3>
      <dl className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
        {entries.map(([key, val]) => (
          <div key={key} className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-3.5 py-2.5">
            <dt className="text-xs font-semibold text-muted-foreground break-all">{key}</dt>
            <dd className="sm:col-span-2 text-sm text-foreground break-all font-mono">
              {val === null || val === undefined
                ? 'null'
                : typeof val === 'object'
                  ? JSON.stringify(val)
                  : String(val)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export default async function BitacoraDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getSessionUsuario()
  if (!session || !puedeVerBitacora(session.rol)) {
    redirect('/')
  }

  const { id } = await params
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('auditoria')
    .select(
      'id, tabla, registro_id, usuario_id, accion, datos_antes, datos_despues, creado_en, usuario:usuarios(id, nombre, email)'
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !data) {
    notFound()
  }

  const ev = data as unknown as AuditoriaEvento
  const nombre =
    ev.usuario && typeof ev.usuario === 'object' && 'nombre' in ev.usuario
      ? (ev.usuario as { nombre: string }).nombre
      : 'Sistema'

  return (
    <main className="page-shell space-y-4">
      <PageHeader
        title={`${etiquetaAccionAuditoria(ev.accion)} · ${etiquetaTablaAuditoria(ev.tabla)}`}
        description={`${nombre} · ${formatearFecha(ev.creado_en)}`}
        backHref="/bitacora"
        backLabel="Bitácora"
        badge={
          <Badge
            variant={
              ev.accion === 'DELETE'
                ? 'red'
                : ev.accion === 'INSERT'
                  ? 'teal'
                  : 'gray'
            }
          >
            {etiquetaAccionAuditoria(ev.accion)}
          </Badge>
        }
      />

      <div className="card space-y-2 text-sm">
        <p>
          <span className="text-muted-foreground">Tabla:</span>{' '}
          <span className="font-semibold text-foreground">{etiquetaTablaAuditoria(ev.tabla)}</span>
          <span className="text-muted-foreground"> ({ev.tabla})</span>
        </p>
        <p>
          <span className="text-muted-foreground">Registro:</span>{' '}
          <code className="font-mono text-xs break-all">{ev.registro_id}</code>
        </p>
        <p>
          <span className="text-muted-foreground">Quién:</span>{' '}
          <span className="font-semibold text-foreground">{nombre}</span>
        </p>
      </div>

      <JsonBlock title="Antes" value={ev.datos_antes} />
      <JsonBlock title="Después" value={ev.datos_despues} />

      <Link
        href="/bitacora"
        className="inline-flex min-h-[44px] items-center text-sm font-semibold text-primary hover:underline"
      >
        Volver a la bitácora
      </Link>
    </main>
  )
}
