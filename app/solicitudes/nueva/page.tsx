import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SolicitudForm } from '@/components/SolicitudForm'
import { createSolicitudAction } from '@/lib/actions/solicitudes'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeCrearSolicitudes, puedeCrearSolicitudMultiObra } from '@/lib/roles'
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
    .select('id, nombre_base, variante, unidad_medida, categoria, subcategoria, precio_base')
    .eq('activo', true)
    .order('nombre_base')

  // Saldos de materiales por obra para validación en tiempo real en UI
  const { data: saldosRaw } = await supabase
    .from('v_saldo_material_obra')
    .select('obra_id, material_id, cantidad_disponible')

  const saldos = (saldosRaw ?? []).map((s) => ({
    obra_id: s.obra_id,
    material_id: s.material_id,
    cantidad_disponible: Number(s.cantidad_disponible ?? 0),
  }))

  return (
    <main className="page-shell">
      <header className="mb-6 pt-4">
        <Link href="/solicitudes" className="text-sm text-[#1E7F7A] font-medium hover:underline">
          ← Solicitudes
        </Link>
        <h1 className="text-2xl font-bold text-[#132A45] mt-2">
          Solicitud para requisición de materiales
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Elige el proyecto y agrega materiales, flete, camiones u otros gastos. Las partidas de materiales validan disponibilidad presupuestal.
        </p>
      </header>

      {!obras?.length ? (
        <p className="text-gray-500 text-center py-8">No hay proyectos activos todavía.</p>
      ) : (
        <SolicitudForm
          action={createSolicitudAction}
          obras={obras}
          materiales={materiales ?? []}
          saldos={saldos}
          defaultObraId={searchParams.obra}
          permiteMultiObra={puedeCrearSolicitudMultiObra(session.rol)}
        />
      )}
    </main>
  )
}
