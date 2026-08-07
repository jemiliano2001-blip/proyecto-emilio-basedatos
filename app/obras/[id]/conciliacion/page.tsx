import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSessionUsuario } from '@/lib/auth/session'
import { formatMoneyMx } from '@/lib/money'
import { puedeVerPrecios } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type {
  ConciliacionMaterialObra,
  ConciliacionPresupuestoObra,
} from '@/lib/types'

export default async function ConciliacionObraPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getSessionUsuario()
  // Este reporte expone presupuesto, gastado y desviación del proyecto. `personal`
  // no ve precios en ninguna otra pantalla (puedeVerPrecios); aquí tampoco.
  if (!session || !puedeVerPrecios(session.rol)) notFound()

  const supabase = createClient()

  const { data: presupuestoData, error: errPres } = await supabase
    .from('v_conciliacion_obra_presupuesto')
    .select('*')
    .eq('obra_id', params.id)
    .maybeSingle()

  if (errPres || !presupuestoData) {
    notFound()
  }

  const { data: materialesData } = await supabase
    .from('v_conciliacion_obra_material')
    .select('*')
    .eq('obra_id', params.id)
    .order('nombre_base')

  const pres = presupuestoData as ConciliacionPresupuestoObra
  const mats = (materialesData as ConciliacionMaterialObra[] | null) ?? []

  const fechaCierre = pres.cerrado_en
    ? new Date(pres.cerrado_en).toLocaleString('es-MX', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null

  const esSuperavit = Number(pres.variacion_saldo_mxn) >= 0

  return (
    <main className="max-w-4xl mx-auto p-4 pb-28 space-y-6">
      <header className="pt-4 flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <Link href={`/obras/${params.id}`} className="text-sm text-[#1E7F7A] font-medium hover:underline">
            ← Volver al Proyecto
          </Link>
          <h1 className="text-2xl font-bold text-[#132A45] mt-1">
            Reporte de Conciliación de Proyecto
          </h1>
          <p className="text-gray-500 text-xs">
            {pres.obra_nombre} {pres.cliente ? `· Cliente: ${pres.cliente}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
              pres.estado === 'cerrada'
                ? 'bg-gray-800 text-white'
                : 'bg-green-100 text-green-800 border border-green-200'
            }`}
          >
            Estatus: {pres.estado}
          </span>
        </div>
      </header>

      {/* Encabezado Imprimible */}
      <div className="hidden print:block border-b border-gray-300 pb-4 mb-4">
        <h1 className="text-xl font-bold text-[#132A45]">REPORTE DE CONCILIACIÓN Y CIERRE DE PROYECTO</h1>
        <p className="text-sm font-semibold">{pres.obra_nombre}</p>
        {pres.cliente && <p className="text-xs">Cliente: {pres.cliente}</p>}
        <p className="text-xs text-gray-500">Fecha de reporte: {new Date().toLocaleDateString('es-MX')}</p>
      </div>

      {/* Tarjeta Resumen Financiero ($ MXN) */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="font-bold text-[#132A45] text-base">
            Conciliación Financiera ($ MXN)
          </h2>
          {fechaCierre && (
            <span className="text-xs text-gray-500 font-medium">
              Fecha de cierre: {fechaCierre}
            </span>
          )}
        </div>

        {pres.cierre_nota && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700">
            <span className="font-semibold block mb-0.5">Nota de cierre:</span>
            {pres.cierre_nota}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
            <span className="text-gray-400 block text-[10px] uppercase font-bold">
              Presupuesto Total
            </span>
            <span className="text-sm font-bold text-gray-900">
              {formatMoneyMx(Number(pres.presupuesto_mxn))}
            </span>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
            <span className="text-gray-400 block text-[10px] uppercase font-bold">
              Gastado Órdenes Compra
            </span>
            <span className="text-sm font-bold text-gray-900">
              {formatMoneyMx(Number(pres.gastado_ordenes_compra_mxn))}
            </span>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
            <span className="text-gray-400 block text-[10px] uppercase font-bold">
              Fletes y Servicios
            </span>
            <span className="text-sm font-bold text-gray-900">
              {formatMoneyMx(
                Number(pres.fletes_camiones_mxn) + Number(pres.servicios_otros_mxn)
              )}
            </span>
          </div>

          <div
            className={`p-3 rounded-lg border ${
              esSuperavit
                ? 'bg-green-50 text-green-900 border-green-200'
                : 'bg-red-50 text-red-900 border-red-200'
            }`}
          >
            <span className="block text-[10px] uppercase font-bold opacity-75">
              {esSuperavit ? 'Remanente / Ahorro' : 'Desviación / Sobrecosto'}
            </span>
            <span className="text-sm font-bold">
              {formatMoneyMx(Math.abs(Number(pres.variacion_saldo_mxn)))}
            </span>
          </div>
        </div>

        {(Number(pres.traspasos_credito_mxn) > 0 ||
          Number(pres.traspasos_cargo_mxn) > 0) && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-900 flex flex-wrap gap-x-6 gap-y-1 justify-between">
            <span className="font-semibold w-full">Movimientos por traspaso de material</span>
            {Number(pres.traspasos_credito_mxn) > 0 && (
              <span>
                Recuperado al ceder material:{' '}
                <strong>+{formatMoneyMx(Number(pres.traspasos_credito_mxn))}</strong>
              </span>
            )}
            {Number(pres.traspasos_cargo_mxn) > 0 && (
              <span>
                Absorbido al recibir material:{' '}
                <strong>−{formatMoneyMx(Number(pres.traspasos_cargo_mxn))}</strong>
              </span>
            )}
          </div>
        )}

        <div className="text-xs text-gray-500 pt-2 flex justify-between border-t border-gray-100">
          <span>Total Ejecutado Acumulado: <strong>{formatMoneyMx(Number(pres.gastado_total_ejecutado_mxn))}</strong></span>
          {Number(pres.reservado_requisiciones_mxn) > 0 && (
            <span>En Reserva Pendiente: <strong>{formatMoneyMx(Number(pres.reservado_requisiciones_mxn))}</strong></span>
          )}
        </div>
      </div>

      {/* Conciliación Física de Materiales */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h2 className="font-bold text-[#132A45] text-base">
              Conciliación Física de Materiales
            </h2>
            <p className="text-xs text-gray-500">
              Comparativo entre topes contratados, movimientos por traspaso, compromiso y recepciones en sitio
            </p>
          </div>
          <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-semibold">
            {mats.length} renglones
          </span>
        </div>

        {mats.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">
            No se registraron materiales contratados ni movimientos en este proyecto.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold text-[11px]">
                  <th className="py-2.5 px-3">Material / Unidad</th>
                  <th className="py-2.5 px-2 text-right">Contratado</th>
                  <th className="py-2.5 px-2 text-right">Traspasos (+/-)</th>
                  <th className="py-2.5 px-2 text-right">Tope Efectivo</th>
                  <th className="py-2.5 px-2 text-right">Usado/Comp.</th>
                  <th className="py-2.5 px-2 text-right">Recibido Sitio</th>
                  <th className="py-2.5 px-2 text-right">Remanente</th>
                  <th className="py-2.5 px-3 text-center">% Ejecución</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mats.map((m) => {
                  const traspasoNeto = Number(m.traspasos_entrada) - Number(m.traspasos_salida)
                  const remanente = Number(m.cantidad_disponible)

                  return (
                    <tr key={m.material_id} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-gray-800 block">
                          {m.nombre_base} {m.variante ? `(${m.variante})` : ''}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {m.unidad_medida} {m.categoria ? `· ${m.categoria}` : ''}
                        </span>
                      </td>

                      <td className="py-2.5 px-2 text-right font-medium text-gray-700">
                        {m.cantidad_contratada}
                      </td>

                      <td className="py-2.5 px-2 text-right font-medium">
                        {traspasoNeto > 0 ? (
                          <span className="text-green-700">+{traspasoNeto}</span>
                        ) : traspasoNeto < 0 ? (
                          <span className="text-red-600">{traspasoNeto}</span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>

                      <td className="py-2.5 px-2 text-right font-bold text-gray-900">
                        {m.cantidad_tope_efectiva}
                      </td>

                      <td className="py-2.5 px-2 text-right font-medium text-blue-700">
                        {Number(m.cantidad_usada) + Number(m.cantidad_comprometida)}
                      </td>

                      <td className="py-2.5 px-2 text-right font-medium text-emerald-700">
                        {m.cantidad_recibida_buena_sitio}
                      </td>

                      <td className="py-2.5 px-2 text-right font-bold">
                        {remanente > 0 ? (
                          <span className="text-[#1E7F7A]">{remanente}</span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                            Number(m.porcentaje_ejecucion) >= 100
                              ? 'bg-amber-100 text-amber-800'
                              : Number(m.porcentaje_ejecucion) > 50
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {m.porcentaje_ejecucion}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Resumen de Sobrantes de Material Disponibles para Traspaso */}
      <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 space-y-2 text-xs text-amber-900">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <span>📦 Materiales Sobrantes Disponibles</span>
        </h3>
        <p>
          Los siguientes materiales cuentan con disponible en vivo. Al cerrar o finalizar la obra, estos remanentes pueden ser traspasados a otro proyecto mediante la función de <strong>Traspasos</strong>:
        </p>

        <ul className="list-disc pl-4 space-y-1 pt-1 font-medium">
          {mats
            .filter((m) => Number(m.cantidad_disponible) > 0)
            .map((m) => (
              <li key={m.material_id}>
                <strong>{m.nombre_base} {m.variante || ''}</strong>: {m.cantidad_disponible} {m.unidad_medida} disponibles
              </li>
            ))}

          {mats.filter((m) => Number(m.cantidad_disponible) > 0).length === 0 && (
            <li className="list-none text-gray-500 italic">No hay materiales sobrantes en esta obra.</li>
          )}
        </ul>
      </div>
    </main>
  )
}
