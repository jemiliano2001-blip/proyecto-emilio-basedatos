import Link from 'next/link'
import { redirect } from 'next/navigation'
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

  const { data: saldos } = await supabase
    .from('v_saldo_material_obra')
    .select('obra_id, material_id, cantidad_disponible')

  return (
    <main className="max-w-2xl mx-auto p-4 pb-28">
      <header className="mb-6 pt-4">
        <Link href="/traspasos" className="text-sm text-[#1E7F7A] font-medium hover:underline">
          ← Traspasos
        </Link>
        <h1 className="text-2xl font-bold text-[#132A45] mt-2">
          Nuevo traspaso de materiales
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Transfiere materiales disponibles de una obra origen a una obra destino
        </p>
      </header>

      {!obras || obras.length < 2 ? (
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-xl border border-yellow-200 text-sm">
          Se requieren al menos 2 obras activas registradas en el sistema para realizar un traspaso.
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
