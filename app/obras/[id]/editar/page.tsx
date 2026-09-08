import { redirect, notFound } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { ObraForm } from '@/components/ObraForm'
import { updateObraAction } from '@/lib/actions/obras'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarObras } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { Obra } from '@/lib/types'

export default async function EditarObraPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedparams = await params
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarObras(session.rol)) {
    redirect(`/obras/${resolvedparams.id}`)
  }

  const supabase = await createClient()
  const { data: obra } = await supabase
    .from('obras')
    .select(
      'id, nombre, cliente, ciudad, fraccionamiento, paquete, ubicacion, estado, presupuesto_mxn, creado_en'
    )
    .eq('id', resolvedparams.id)
    .maybeSingle()

  if (!obra) notFound()
  if (obra.estado === 'cerrada') redirect(`/obras/${resolvedparams.id}`)

  const updateAction = updateObraAction.bind(null, resolvedparams.id)

  return (
    <main className="page-shell">
      <PageHeader
        title="Editar proyecto"
        description={obra.nombre}
        backHref={`/obras/${resolvedparams.id}`}
        backLabel="Volver al proyecto"
      />
      <ObraForm
        action={updateAction}
        obra={obra as Obra}
        submitLabel="Guardar cambios"
      />
    </main>
  )
}
