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
  params: { id: string }
}) {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarObras(session.rol)) {
    redirect(`/obras/${params.id}`)
  }

  const supabase = createClient()
  const { data: obra } = await supabase
    .from('obras')
    .select(
      'id, nombre, cliente, ciudad, fraccionamiento, paquete, ubicacion, estado, presupuesto_mxn, creado_en'
    )
    .eq('id', params.id)
    .maybeSingle()

  if (!obra) notFound()

  const updateAction = updateObraAction.bind(null, params.id)

  return (
    <main className="page-shell">
      <PageHeader
        title="Editar proyecto"
        description={obra.nombre}
        backHref={`/obras/${params.id}`}
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
