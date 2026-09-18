import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/Badge'
import { IconPaquete } from '@/components/icons'
import { ExportarConciliacionButton } from '@/components/ExportarConciliacionButton'
import { getSessionUsuario } from '@/lib/auth/session'
import { formatMoneyMx } from '@/lib/money'
import { puedeVerPrecios } from '@/lib/roles'
import { esRelacionAusente } from '@/lib/schema-disponible'
import { createClient } from '@/lib/supabase/server'
import type {
  ConciliacionMaterialObra,
  ConciliacionPresupuestoObra,
} from '@/lib/types'

export default async function ConciliacionObraPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedparams = await params
  const session = await getSessionUsuario()
  // Este reporte expone presupuesto, gastado y desviación del proyecto. `personal`
  // no ve precios en ninguna otra pantalla (puedeVerPrecios); aquí tampoco.
  if (!session || !puedeVerPrecios(session.rol)) notFound()

  const supabase = await createClient()

  const { data: presupuestoData, error: errPres } = await supabase
    .rpc('conciliacion_presupuesto_proyecto', { p_obra_id: resolvedparams.id })
    .maybeSingle()

  if (errPres) {
    if (esRelacionAusente(errPres)) {
      return (
        <main className="page-shell">
          <PageHeader
            title="Conciliación"
            backHref={`/obras/${resolvedparams.id}`}
            backLabel="Volver al proyecto"
          />
          <div className="card mt-4 border-warning/30 bg-warning-soft text-warning-soft-foreground">
            El reporte de conciliación todavía no está activo en la base. Cuando se
            aplique la migración, esta pantalla va a funcionar.
          </div>
        </main>
      )
    }
    notFound()
  }

  if (!presupuestoData) {
    notFound()
  }

  const { data: materialesData } = await supabase
    .from('v_conciliacion_obra_material')
    .select('*')
    .eq('obra_id', resolvedparams.id)
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
    <main className="page-shell-wide space-y-6">
      <PageHeader
        className="print:hidden"
        title="Reporte de Conciliación de Proyecto"
        description={`${pres.obra_nombre}${pres.cliente ? ` · Cliente: ${pres.cliente}` : ''}`}
        backHref={`/obras/${resolvedparams.id}`}
        backLabel="Volver al proyecto"
        badge={
          <Badge variant={pres.estado === 'cerrada' ? 'gray' : 'teal'}>
            Estatus: {pres.estado}
          </Badge>
        }
        actions={
          <div className="flex items-center gap-2">
            <ExportarConciliacionButton
              presupuesto={pres}
              materiales={mats}
            />
          </div>
        }
      />

      {/* Encabezado Imprimible */}
      <div className="hidden print:block border-b border-input pb-4 mb-4">
        <h1 className="text-xl font-bold text-foreground">REPORTE DE CONCILIACIÓN Y CIERRE DE PROYECTO</h1>
        <p className="text-sm font-semibold">{pres.obra_nombre}</p>
        {pres.cliente && <p className="text-xs">Cliente: {pres.cliente}</p>}
        <p className="text-xs text-muted-foreground">Fecha de reporte: {new Date().toLocaleDateString('es-MX')}</p>
      </div>

      {/* Tarjeta Resumen Financiero ($ MXN) */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-rule pb-3">
          <h2 className="font-bold text-foreground text-base">
            Conciliación Financiera ($ MXN)
          </h2>
          {fechaCierre && (
            <span className="text-xs text-muted-foreground font-medium">
              Fecha de cierre: {fechaCierre}
            </span>
          )}
        </div>

        {pres.cierre_nota && (
          <div className="bg-muted/50 border border-border rounded-lg p-3 text-xs text-foreground">
            <span className="font-semibold block mb-0.5">Nota de cierre:</span>
            {pres.cierre_nota}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="bg-muted/50 p-3 rounded-lg border border-border">
            <span className="text-muted-foreground block text-[10px] uppercase font-bold">
              Presupuesto Total
            </span>
            <span className="text-sm font-bold text-foreground">
              {formatMoneyMx(Number(pres.presupuesto_mxn))}
            </span>
          </div>

          <div className="bg-muted/50 p-3 rounded-lg border border-border">
            <span className="text-muted-foreground block text-[10px] uppercase font-bold">
              Gastado Órdenes Compra
            </span>
            <span className="text-sm font-bold text-foreground">
              {formatMoneyMx(Number(pres.gastado_ordenes_compra_mxn))}
            </span>
          </div>

          <div className="bg-muted/50 p-3 rounded-lg border border-border">
            <span className="text-muted-foreground block text-[10px] uppercase font-bold">
              Fletes y Servicios
            </span>
            <span className="text-sm font-bold text-foreground">
              {formatMoneyMx(
                Number(pres.fletes_camiones_mxn) + Number(pres.servicios_otros_mxn)
              )}
            </span>
          </div>

          <div
            className={`p-3 rounded-lg border ${
              esSuperavit
                ? 'bg-success-soft text-success-soft-foreground border-success/30'
                : 'bg-danger-soft text-danger-soft-foreground border-danger/30'
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
          <div className="bg-info-soft border border-info/30 rounded-lg p-3 text-xs text-info-soft-foreground flex flex-wrap gap-x-6 gap-y-1 justify-between">
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

        <div className="text-xs text-muted-foreground pt-2 flex justify-between border-t border-border">
          <span>Total Ejecutado Acumulado: <strong>{formatMoneyMx(Number(pres.gastado_total_ejecutado_mxn))}</strong></span>
          {Number(pres.reservado_requisiciones_mxn) > 0 && (
            <span>En Reserva Pendiente: <strong>{formatMoneyMx(Number(pres.reservado_requisiciones_mxn))}</strong></span>
          )}
        </div>
      </div>

      {/* Conciliación Física de Materiales */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-rule pb-3">
          <div>
            <h2 className="font-bold text-foreground text-base">
              Conciliación Física de Materiales
            </h2>
            <p className="text-xs text-muted-foreground">
              Comparativo entre topes contratados, movimientos por traspaso, compromiso y recepciones en sitio
            </p>
          </div>
          <span className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full font-semibold">
            {mats.length} renglones
          </span>
        </div>

        {mats.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            No se registraron materiales contratados ni movimientos en este proyecto.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold text-[11px]">
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
              <tbody className="divide-y divide-border">
                {mats.map((m) => {
                  const traspasoNeto = Number(m.traspasos_entrada) - Number(m.traspasos_salida)
                  const remanente = Number(m.cantidad_disponible)

                  return (
                    <tr key={m.material_id} className="hover:bg-muted/50">
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-foreground block">
                          {m.nombre_base} {m.variante ? `(${m.variante})` : ''}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {m.unidad_medida} {m.categoria ? `· ${m.categoria}` : ''}
                        </span>
                      </td>

                      <td className="py-2.5 px-2 text-right font-medium text-foreground">
                        {m.cantidad_contratada}
                      </td>

                      <td className="py-2.5 px-2 text-right font-medium">
                        {traspasoNeto > 0 ? (
                          <span className="text-success-soft-foreground">+{traspasoNeto}</span>
                        ) : traspasoNeto < 0 ? (
                          <span className="text-danger">{traspasoNeto}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>

                      <td className="py-2.5 px-2 text-right font-bold text-foreground">
                        {m.cantidad_tope_efectiva}
                      </td>

                      <td className="py-2.5 px-2 text-right font-medium text-info-soft-foreground">
                        {Number(m.cantidad_usada) + Number(m.cantidad_comprometida)}
                      </td>

                      <td className="py-2.5 px-2 text-right font-medium text-success-soft-foreground">
                        {m.cantidad_recibida_buena_sitio}
                      </td>

                      <td className="py-2.5 px-2 text-right font-bold">
                        {remanente > 0 ? (
                          <span className="text-primary">{remanente}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                            Number(m.porcentaje_ejecucion) >= 100
                              ? 'bg-warning-soft text-warning-soft-foreground'
                              : Number(m.porcentaje_ejecucion) > 50
                              ? 'bg-info-soft text-info-soft-foreground'
                              : 'bg-muted text-muted-foreground'
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
      <div className="bg-warning-soft rounded-xl border border-warning/30 p-4 space-y-2 text-xs text-warning-soft-foreground">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <IconPaquete className="w-4 h-4 text-warning-soft-foreground" />
          <span>Materiales Sobrantes Disponibles</span>
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
            <li className="list-none text-muted-foreground italic">No hay materiales sobrantes en esta obra.</li>
          )}
        </ul>
      </div>
    </main>
  )
}
