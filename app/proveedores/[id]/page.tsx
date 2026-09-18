import { notFound, redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { ProveedorForm } from '@/components/ProveedorForm'
import { updateProveedorAction } from '@/lib/actions/proveedores'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarProveedores } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { Proveedor } from '@/lib/types'

export default async function EditarProveedorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedparams = await params
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarProveedores(session.rol)) {
    redirect('/proveedores')
  }

  const supabase = await createClient()
  const { data: proveedor } = await supabase
    .from('proveedores')
    .select('id, nombre, contacto, telefono, activo, creado_en')
    .eq('id', resolvedparams.id)
    .maybeSingle()

  if (!proveedor) notFound()

  const updateAction = updateProveedorAction.bind(null, resolvedparams.id)

  return (
    <main className="page-shell-narrow">
      <PageHeader
        title="Editar proveedor"
        subtitle={proveedor.nombre}
        backHref="/proveedores"
        backLabel="Proveedores"
      />
      <ProveedorForm
        action={updateAction}
        proveedor={proveedor as Proveedor}
        submitLabel="Guardar cambios"
      />
    </main>
  )
}
