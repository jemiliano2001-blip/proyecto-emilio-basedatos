import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { TraspasoForm } from '@/components/TraspasoForm'
import { crearTraspasoAction } from '@/lib/actions/traspasos'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeSolicitarTraspaso } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'

export default async function NuevoTraspasoPage() {
  const session = await getSessionUsuario()
  if (!session || !puedeSolicitarTraspaso(session.rol)) {
    redirect('/traspasos')
  }

  const supabase = await createClient()

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

  const { data: saldos } = await supabase
    .from('v_saldo_material_obra')
    .select('obra_id, material_id, cantidad_disponible')

  return (
    <main className="page-shell">
      <PageHeader
        title="Nuevo traspaso de materiales"
        description="Transfiere materiales disponibles de un proyecto origen a un proyecto destino"
        backHref="/traspasos"
        backLabel="Traspasos"
      />

      {!obras || obras.length < 2 ? (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          Se requieren al menos 2 proyectos activos para realizar un traspaso.
        </div>
      ) : (
        <TraspasoForm
          action={crearTraspasoAction}
          obras={obras}
          materiales={materiales ?? []}
          saldos={(saldos as unknown as { obra_id: string; material_id: string; cantidad_disponible: number }[]) ?? []}
        />
      )}
    </main>
  )
}
