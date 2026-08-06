import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
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
      'id, nombre, cliente, fraccionamiento, paquete, ubicacion, estado, presupuesto_mxn, creado_en'
    )
    .eq('id', params.id)
    .maybeSingle()

  if (!obra) notFound()

  const updateAction = updateObraAction.bind(null, params.id)

  return (
    <main className="max-w-2xl mx-auto p-4 pb-28">
      <header className="mb-6 pt-4">
        <Link href={`/obras/${params.id}`} className="text-sm text-[#1E7F7A] font-medium">
          ← Volver al proyecto
        </Link>
        <h1 className="text-2xl font-bold text-[#132A45] mt-2">Editar proyecto</h1>
      </header>
      <ObraForm
        action={updateAction}
        obra={obra as Obra}
        submitLabel="Guardar cambios"
      />
    </main>
  )
}
