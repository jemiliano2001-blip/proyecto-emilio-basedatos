import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ProveedorForm } from '@/components/ProveedorForm'
import { updateProveedorAction } from '@/lib/actions/proveedores'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarProveedores } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { Proveedor } from '@/lib/types'

export default async function EditarProveedorPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarProveedores(session.rol)) {
    redirect('/proveedores')
  }

  const supabase = createClient()
  const { data: proveedor } = await supabase
    .from('proveedores')
    .select('id, nombre, contacto, telefono, activo, creado_en')
    .eq('id', params.id)
    .maybeSingle()

  if (!proveedor) notFound()

  const updateAction = updateProveedorAction.bind(null, params.id)

  return (
    <main className="page-shell">
      <header className="mb-6 pt-4">
        <Link href="/proveedores" className="text-sm text-[#1E7F7A] font-medium">
          ← Proveedores
        </Link>
        <h1 className="text-2xl font-bold text-[#132A45] mt-2">Editar proveedor</h1>
      </header>
      <ProveedorForm
        action={updateAction}
        proveedor={proveedor as Proveedor}
        submitLabel="Guardar cambios"
      />
    </main>
  )
}
