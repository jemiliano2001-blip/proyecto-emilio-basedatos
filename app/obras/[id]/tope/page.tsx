import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { TopeForm } from '@/components/TopeForm'
import { createTopeAction } from '@/lib/actions/topes'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarTopes } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'

export default async function NuevoTopePage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarTopes(session.rol)) {
    redirect(`/obras/${params.id}`)
  }

  const supabase = createClient()
  const { data: obra } = await supabase
    .from('obras')
    .select('id, nombre')
    .eq('id', params.id)
    .maybeSingle()

  if (!obra) notFound()

  const { data: materiales } = await supabase
    .from('catalogo_materiales')
    .select('id, nombre_base, variante, unidad_medida')
    .eq('activo', true)
    .order('nombre_base')

  const { data: topesExistentes } = await supabase
    .from('obra_material_contratado')
    .select('material_id')
    .eq('obra_id', params.id)

  const usados = new Set((topesExistentes ?? []).map((t) => t.material_id))
  const disponibles = (materiales ?? []).filter((m) => !usados.has(m.id))

  return (
    <main className="page-shell">
      <header className="mb-6 pt-4">
        <Link href={`/obras/${params.id}`} className="text-sm text-[#1E7F7A] font-medium">
          ← Volver a {obra.nombre}
        </Link>
        <h1 className="text-2xl font-bold text-[#132A45] mt-2">
          Agregar material contratado
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Define el tope contratado para este proyecto
        </p>
      </header>

      {disponibles.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          No hay materiales disponibles para agregar. Crea materiales en el catálogo
          o ya están todos asignados a este proyecto.
        </p>
      ) : (
        <TopeForm
          action={createTopeAction}
          obraId={params.id}
          materiales={disponibles}
          submitLabel="Guardar tope"
        />
      )}
    </main>
  )
}
