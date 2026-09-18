import { notFound, redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { RecepcionForm } from '@/components/RecepcionForm'
import { crearRecepcionAction } from '@/lib/actions/recepciones'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeCapturarRecepcion } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { OrdenItemChecklist } from '@/lib/types'

export default async function RecibirOrdenPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedparams = await params
  const session = await getSessionUsuario()
  if (!session || !puedeCapturarRecepcion(session.rol)) {
    redirect('/')
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('detalle_orden_checklist', {
    p_orden_id: resolvedparams.id,
  })

  if (error) {
    notFound()
  }

  const items = (data ?? []) as OrdenItemChecklist[]
  if (items.length === 0) {
    notFound()
  }

  const cabecera = items[0]

  return (
    <main className="page-shell-narrow">
      <PageHeader
        title={`Checklist · ${cabecera.folio}`}
        description={
          <div>
            <p className="text-sm font-medium text-foreground">{cabecera.obra_nombre}</p>
            {cabecera.proveedor_nombre && (
              <p className="text-xs text-muted-foreground">{cabecera.proveedor_nombre}</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5 capitalize">
              Estado OC: {String(cabecera.orden_estado).replaceAll('_', ' ')}
            </p>
          </div>
        }
        backHref="/recepciones"
        backLabel="Recepción"
      />

      <RecepcionForm action={crearRecepcionAction} ordenId={resolvedparams.id} items={items} />
    </main>
  )
}
