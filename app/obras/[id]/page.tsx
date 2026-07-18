import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeCrearSolicitudes, puedeGestionarObras, puedeGestionarTopes } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { SaldoMaterialObra } from '@/lib/types'
import { EditTopeInline } from '@/components/EditTopeInline'

export default async function ObraDetallePage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getSessionUsuario()
  const supabase = createClient()
  const puedeEditarObra = puedeGestionarObras(session?.rol ?? null)
  const puedeTopes = puedeGestionarTopes(session?.rol ?? null)
  const puedeSolicitar = puedeCrearSolicitudes(session?.rol ?? null)

  const { data: obra } = await supabase
    .from('obras')
    .select('id, nombre, fraccionamiento, paquete, estado')
    .eq('id', params.id)
    .maybeSingle()

  if (!obra) notFound()

  const { data: saldos } = await supabase
    .from('v_saldo_material_obra')
    .select('*')
    .eq('obra_id', params.id)
    .order('nombre_base')

  const { data: topes } = await supabase
    .from('obra_material_contratado')
    .select('id, material_id, cantidad_contratada')
    .eq('obra_id', params.id)

  const topePorMaterial = new Map(
    (topes ?? []).map((t) => [t.material_id, t])
  )

  return (
    <main className="max-w-2xl mx-auto p-4 pb-28">
      <header className="mb-6 pt-4">
        <Link href="/" className="text-sm text-[#1E7F7A] font-medium">
          ← Obras
        </Link>
        <div className="flex items-start justify-between gap-3 mt-2">
          <div>
            <h1 className="text-2xl font-bold text-[#132A45]">{obra.nombre}</h1>
            {obra.fraccionamiento && (
              <p className="text-gray-500 text-sm">
                {obra.fraccionamiento}
                {obra.paquete ? ` · ${obra.paquete}` : ''}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1 capitalize">Estado: {obra.estado}</p>
          </div>
          {puedeEditarObra && (
            <Link
              href={`/obras/${params.id}/editar`}
              className="btn-primary shrink-0 text-sm py-2 px-4"
            >
              Editar
            </Link>
          )}
        </div>
      </header>

      {puedeSolicitar && (
        <Link
          href={`/solicitudes/nueva?obra=${params.id}`}
          className="btn-primary w-full text-center block mb-6"
        >
          Solicitar material
        </Link>
      )}

      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Saldo de materiales
        </h2>
        {puedeTopes && (
          <Link
            href={`/obras/${params.id}/tope`}
            className="text-sm font-semibold text-[#1E7F7A]"
          >
            + Agregar
          </Link>
        )}
      </div>

      <p className="text-xs text-gray-400 mb-3">
        En Fase 1 el &quot;usado&quot; es 0 — se activa en Fase 5 con asignaciones.
      </p>

      <div className="space-y-2">
        {(saldos as SaldoMaterialObra[] | null)?.map((s) => {
          const tope = topePorMaterial.get(s.material_id)
          return (
            <div key={s.material_id} className="card">
              <div className="flex justify-between items-baseline">
                <p className="font-medium">
                  {s.nombre_base}
                  {s.variante && (
                    <span className="text-gray-500"> · {s.variante}</span>
                  )}
                </p>
                <span className="text-sm text-gray-500">{s.unidad_medida}</span>
              </div>
              <div className="mt-2 flex gap-4 text-sm">
                <span className="text-gray-500">
                  Contratado:{' '}
                  <b className="text-gray-900">{s.cantidad_contratada}</b>
                </span>
                <span className="text-gray-500">
                  Disponible:{' '}
                  <b className="text-[#1E7F7A]">{s.cantidad_disponible}</b>
                </span>
              </div>
              {puedeTopes && tope && (
                <EditTopeInline
                  topeId={tope.id}
                  obraId={params.id}
                  materialId={s.material_id}
                  cantidadActual={Number(tope.cantidad_contratada)}
                />
              )}
            </div>
          )
        })}

        {saldos?.length === 0 && (
          <p className="text-gray-500 text-center py-8">
            Todavía no hay materiales contratados para esta obra.
          </p>
        )}
      </div>
    </main>
  )
}
