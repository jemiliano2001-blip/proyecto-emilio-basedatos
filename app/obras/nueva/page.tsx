import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ObraForm } from '@/components/ObraForm'
import { createObraAction } from '@/lib/actions/obras'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarObras } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'

export default async function NuevaObraPage() {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarObras(session.rol)) {
    redirect('/')
  }

  const supabase = createClient()
  const { data: materiales } = await supabase
    .from('catalogo_materiales')
    .select('id, nombre_base, variante, unidad_medida')
    .eq('activo', true)
    .order('nombre_base')

  return (
    <main className="max-w-2xl mx-auto p-4 pb-28">
      <header className="mb-6 pt-4">
        <Link href="/" className="text-sm text-[#1E7F7A] font-medium">
          ← Volver a proyectos
        </Link>
        <h1 className="text-2xl font-bold text-[#132A45] mt-2">Nuevo proyecto</h1>
      </header>
      <ObraForm
        action={createObraAction}
        submitLabel="Crear proyecto"
        materiales={materiales ?? []}
        allowTopesOnCreate
      />
    </main>
  )
}
