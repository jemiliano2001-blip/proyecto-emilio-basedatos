import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeCerrarObra, puedeCrearSolicitudes, puedeGestionarObras, puedeGestionarTopes, puedeReabrirObra } from '@/lib/roles'
import { formatMoneyMx } from '@/lib/money'
import { createClient } from '@/lib/supabase/server'
import type { SaldoMaterialObra, SaldoPresupuestoObra } from '@/lib/types'
import { EditTopeInline } from '@/components/EditTopeInline'
import { CierreObraAcciones } from '@/components/CierreObraAcciones'

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
  const puedeCerrar = puedeCerrarObra(session?.rol ?? null)
  const puedeReabrir = puedeReabrirObra(session?.rol ?? null)

  const { data: obra } = await supabase
    .from('obras')
    .select('id, nombre, cliente, fraccionamiento, paquete, estado, presupuesto_mxn')
    .eq('id', params.id)
    .maybeSingle()

  if (!obra) notFound()

  const { data: saldos } = await supabase
    .from('v_saldo_material_obra')
    .select('*')
    .eq('obra_id', params.id)
    .order('nombre_base')

  const { data: saldoMx } = await supabase
    .from('v_saldo_presupuesto_obra')
    .select('*')
    .eq('obra_id', params.id)
    .maybeSingle()

  const { data: topes } = await supabase
    .from('obra_material_contratado')
    .select('id, material_id, cantidad_contratada')
    .eq('obra_id', params.id)

  const topePorMaterial = new Map((topes ?? []).map((t) => [t.material_id, t]))
  const presupuesto = saldoMx as SaldoPresupuestoObra | null

  return (
    <main className="max-w-2xl mx-auto p-4 pb-28">
      <header className="mb-6 pt-4">
        <Link href="/" className="text-sm text-[#1E7F7A] font-medium">
          ← Proyectos
        </Link>
        <div className="flex items-start justify-between gap-3 mt-2">
          <div>
            <h1 className="text-2xl font-bold text-[#132A45]">{obra.nombre}</h1>
            {obra.cliente && <p className="text-gray-600 text-sm">Cliente: {obra.cliente}</p>}
            {obra.fraccionamiento && (
              <p className="text-gray-500 text-sm">
                {obra.fraccionamiento}
                {obra.paquete ? ` · ${obra.paquete}` : ''}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1 capitalize">Estatus: {obra.estado}</p>
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

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <Link
            href={`/obras/${params.id}/conciliacion`}
            className="bg-[#132A45] hover:bg-[#1f3f66] text-white font-semibold text-xs py-2 px-3 rounded-lg shadow-sm transition inline-flex items-center gap-1.5"
          >
            📊 Reporte de Conciliación
          </Link>

          <CierreObraAcciones
            obraId={obra.id}
            estado={obra.estado}
            puedeCerrar={puedeCerrar}
            puedeReabrir={puedeReabrir}
          />
        </div>
      </header>

      {puedeSolicitar && obra.estado === 'activa' && (
        <Link
          href={`/solicitudes/nueva?obra=${params.id}`}
          className="btn-primary w-full text-center block mb-6"
        >
          Solicitar material
        </Link>
      )}

      <div className="card mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Presupuesto (MXN)
        </h2>
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-gray-500">
            Total:{' '}
            <b className="text-gray-900">
              {formatMoneyMx(Number(presupuesto?.presupuesto_mxn ?? obra.presupuesto_mxn ?? 0))}
            </b>
          </span>
          <span className="text-gray-500">
            Comprometido:{' '}
            <b className="text-gray-900">
              {formatMoneyMx(Number(presupuesto?.comprometido_mxn ?? 0))}
            </b>
          </span>
          <span className="text-gray-500">
            Gastado:{' '}
            <b className="text-gray-900">
              {formatMoneyMx(Number(presupuesto?.gastado_mxn ?? 0))}
            </b>
          </span>
          <span className="text-gray-500">
            Disponible:{' '}
            <b className="text-[#1E7F7A]">
              {formatMoneyMx(Number(presupuesto?.disponible_mxn ?? obra.presupuesto_mxn ?? 0))}
            </b>
          </span>
        </div>
      </div>

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
        Saldo = presupuesto de cantidad. Disponible resta comprometido y usado.
      </p>

      <div className="space-y-2">
        {(saldos as SaldoMaterialObra[] | null)?.map((s) => {
          const tope = topePorMaterial.get(s.material_id)
          return (
            <div key={s.material_id} className="card">
              <div className="flex justify-between items-baseline">
                <p className="font-medium">
                  {s.nombre_base}
                  {s.variante && <span className="text-gray-500"> · {s.variante}</span>}
                </p>
                <span className="text-sm text-gray-500">{s.unidad_medida}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                <span className="text-gray-500">
                  Contratado: <b className="text-gray-900">{s.cantidad_contratada}</b>
                </span>
                {s.cantidad_comprometida !== undefined && Number(s.cantidad_comprometida) > 0 && (
                  <span className="text-gray-500">
                    Comprometido:{' '}
                    <b className="text-gray-900">{s.cantidad_comprometida}</b>
                  </span>
                )}
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
            Todavía no hay materiales contratados para este proyecto.
          </p>
        )}
      </div>
    </main>
  )
}
