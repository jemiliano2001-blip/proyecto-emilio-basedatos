import { notFound, redirect } from 'next/navigation'
import { ChecklistRecepcion } from '@/components/ChecklistRecepcion'
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
      <ChecklistRecepcion
        action={crearRecepcionAction}
        ordenId={resolvedparams.id}
        folio={cabecera.folio}
        obraNombre={cabecera.obra_nombre}
        items={items}
      />
    </main>
  )
}
