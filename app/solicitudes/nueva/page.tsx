import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SolicitudForm } from '@/components/SolicitudForm'
import { createSolicitudAction } from '@/lib/actions/solicitudes'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeCrearSolicitudes } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'

export default async function NuevaSolicitudPage({
  searchParams,
}: {
  searchParams: { obra?: string }
}) {
  const session = await getSessionUsuario()
  if (!session || !puedeCrearSolicitudes(session.rol)) {
    redirect('/solicitudes')
  }

  const supabase = createClient()

  const { data: obras } = await supabase
    .from('obras')
    .select('id, nombre, fraccionamiento')
    .eq('estado', 'activa')
    .order('nombre')

  const { data: materiales } = await supabase
    .from('catalogo_materiales')
    .select('id, nombre_base, variante, unidad_medida')
    .eq('activo', true)
    .order('nombre_base')

  return (
    <main className="max-w-2xl mx-auto p-4 pb-28">
      <header className="mb-6 pt-4">
        <Link href="/solicitudes" className="text-sm text-[#1E7F7A] font-medium">
          ← Solicitudes
        </Link>
        <h1 className="text-2xl font-bold text-[#132A45] mt-2">Nueva solicitud</h1>
        <p className="text-gray-500 text-sm mt-1">
          Elige la obra y agrega los materiales que necesitas
        </p>
      </header>

      {!obras?.length || !materiales?.length ? (
        <p className="text-gray-500 text-center py-8">
          {!obras?.length
            ? 'No hay obras activas todavía.'
            : 'El catálogo de materiales está vacío todavía.'}
        </p>
      ) : (
        <SolicitudForm
          action={createSolicitudAction}
          obras={obras}
          materiales={materiales}
          defaultObraId={searchParams.obra}
        />
      )}
    </main>
  )
}
