import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CierreObraAcciones } from '@/components/CierreObraAcciones'
import { EditTopeInline } from '@/components/EditTopeInline'
import { ObraDocumentos } from '@/components/ObraDocumentos'
import { getSessionUsuario } from '@/lib/auth/session'
import { formatMoneyMx } from '@/lib/money'
import {
  puedeCerrarObra,
  puedeCrearSolicitudes,
  puedeEliminarDocumentos,
  puedeGestionarDocumentos,
  puedeGestionarObras,
  puedeGestionarTopes,
  puedeReabrirObra,
  puedeVerPrecios,
} from '@/lib/roles'
import { conciliacionSchemaDisponible } from '@/lib/schema-disponible'
import { createClient } from '@/lib/supabase/server'
import type { ObraDocumento, SaldoMaterialObra, SaldoPresupuestoObra } from '@/lib/types'

function labelEstatus(estado: string): string {
  if (estado === 'pausada') return 'Pausado'
  if (estado === 'cerrada') return 'Cerrado'
  return 'Activo'
}

export default async function ObraDetallePage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getSessionUsuario()
  const supabase = createClient()
  const rol = session?.rol ?? null
  const puedeEditarObra = puedeGestionarObras(rol)
  const puedeTopes = puedeGestionarTopes(rol)
  const puedeSolicitar = puedeCrearSolicitudes(rol)
  const puedeCerrar = puedeCerrarObra(rol)
  const puedeReabrir = puedeReabrirObra(rol)
  const verPrecios = puedeVerPrecios(rol)
  const verConciliacion = verPrecios && (await conciliacionSchemaDisponible())
  const puedeGestionarDocs = puedeGestionarDocumentos(rol)
  const puedeEliminarDocs = puedeEliminarDocumentos(rol)

  const { data: obra } = await supabase
    .from('obras')
    .select('id, nombre, cliente, fraccionamiento, paquete, ubicacion, estado, presupuesto_mxn')
    .eq('id', params.id)
    .maybeSingle()

  if (!obra) notFound()

  const { data: saldos } = await supabase
    .from('v_saldo_material_obra')
    .select('*')
    .eq('obra_id', params.id)
    .order('nombre_base')

  const { data: saldoMx } = verPrecios
    ? await supabase
        .from('v_saldo_presupuesto_obra')
        .select('*')
        .eq('obra_id', params.id)
        .maybeSingle()
    : { data: null }

  const { data: topes } = await supabase
    .from('obra_material_contratado')
    .select('id, material_id, cantidad_contratada')
    .eq('obra_id', params.id)

  // Documentos adjuntos PDF
  const { data: documentosRaw } = await supabase
    .from('obra_documentos')
    .select(`
      id,
      obra_id,
      nombre,
      tipo_documento,
      archivo_path,
      archivo_url,
      tamano_bytes,
      subido_por,
      creado_en,
      usuarios:subido_por (nombre)
    `)
    .eq('obra_id', params.id)
    .order('creado_en', { ascending: false })

  const documentos: ObraDocumento[] = (documentosRaw ?? []).map((d: any) => ({
    id: d.id,
    obra_id: d.obra_id,
    nombre: d.nombre,
    tipo_documento: d.tipo_documento,
    archivo_path: d.archivo_path,
    archivo_url: d.archivo_url,
    tamano_bytes: d.tamano_bytes,
    subido_por: d.subido_por,
    creado_en: d.creado_en,
    subido_por_nombre: d.usuarios?.nombre ?? null,
  }))

  const topePorMaterial = new Map((topes ?? []).map((t) => [t.material_id, t]))
  const presupuesto = saldoMx as SaldoPresupuestoObra | null

  return (
    <main className="page-shell space-y-6">
      <header className="pt-2">
        <Link href="/" className="text-sm font-medium text-accent hover:underline">
          ← Proyectos
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink">{obra.nombre}</h1>
            {obra.cliente && <p className="text-sm text-gray-600">Cliente: {obra.cliente}</p>}
            {obra.fraccionamiento && (
              <p className="text-sm text-gray-500">
                Fracc: {obra.fraccionamiento}
                {obra.paquete ? ` · ${obra.paquete}` : ''}
              </p>
            )}
            {obra.ubicacion && (
              <p className="text-xs text-gray-500 mt-0.5">Ubicación: {obra.ubicacion}</p>
            )}
            <p className="mt-1 text-xs text-gray-400">Estatus: {labelEstatus(obra.estado)}</p>
          </div>
          {puedeEditarObra && (
            <Link href={`/obras/${params.id}/editar`} className="btn-primary shrink-0 px-4 py-2 text-sm">
              Editar
            </Link>
          )}
        </div>

        {(verConciliacion || puedeCerrar || puedeReabrir) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {verConciliacion && (
              <Link href={`/obras/${params.id}/conciliacion`} className="btn-secondary px-4 py-2 text-sm">
                Conciliación
              </Link>
            )}
            <CierreObraAcciones
              obraId={obra.id}
              estado={obra.estado}
              puedeCerrar={puedeCerrar}
              puedeReabrir={puedeReabrir}
            />
          </div>
        )}
      </header>

      {puedeSolicitar && obra.estado === 'activa' && (
        <Link
          href={`/solicitudes/nueva?obra=${params.id}`}
          className="btn-primary block w-full text-center"
        >
          + Solicitar material
        </Link>
      )}

      {/* PRESUPUESTO FINANCIERO (Solo roles con acceso a dinero) */}
      {verPrecios && (
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Presupuesto (MXN)
          </h2>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-gray-500">Total</p>
              <p className="tabular-nums font-semibold text-gray-900">
                {formatMoneyMx(Number(presupuesto?.presupuesto_mxn ?? obra.presupuesto_mxn ?? 0))}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Comprometido</p>
              <p className="tabular-nums font-semibold text-gray-900">
                {formatMoneyMx(Number(presupuesto?.comprometido_mxn ?? 0))}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Gastado</p>
              <p className="tabular-nums font-semibold text-gray-900">
                {formatMoneyMx(Number(presupuesto?.gastado_mxn ?? 0))}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Disponible</p>
              <p className="tabular-nums font-semibold text-accent">
                {formatMoneyMx(Number(presupuesto?.disponible_mxn ?? obra.presupuesto_mxn ?? 0))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SECCIÓN 1: SALDO Y ESTATUS DE MATERIALES */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Saldo y Estatus de Materiales
          </h2>
          {puedeTopes && (
            <Link href={`/obras/${params.id}/tope`} className="min-h-[40px] inline-flex items-center text-sm font-semibold text-accent">
              + Asignar material
            </Link>
          )}
        </div>

        <p className="text-xs text-gray-400">
          Control de partidas: Asignado, Entregado / En proceso y Saldo Disponible para requisiciones.
        </p>

        <div className="space-y-2">
          {(saldos as SaldoMaterialObra[] | null)?.map((s) => {
            const tope = topePorMaterial.get(s.material_id)
            const asignado = Number(s.cantidad_contratada ?? 0)
            const usado = Number(s.cantidad_usada ?? 0)
            const comprometido = Number(s.cantidad_comprometida ?? 0)
            const entregadoOComprado = usado + comprometido
            const disponible = Number(s.cantidad_disponible ?? 0)
            const sinSaldo = disponible <= 0

            return (
              <div
                key={s.material_id}
                className={`card ${sinSaldo ? 'border-red-200 bg-red-50/20' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink">
                      {s.nombre_base}
                      {s.variante && <span className="text-gray-500"> · {s.variante}</span>}
                    </p>
                    <span className="text-xs text-gray-500">{s.unidad_medida}</span>
                  </div>

                  {sinSaldo && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-700">
                      Sin saldo disponible
                    </span>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs">Asignado</p>
                    <p className="tabular-nums font-semibold text-gray-900">{asignado}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Entregado / Proceso</p>
                    <p className="tabular-nums font-semibold text-gray-900">{entregadoOComprado}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Disponible</p>
                    <p
                      className={`tabular-nums font-bold ${
                        sinSaldo ? 'text-red-600' : 'text-accent'
                      }`}
                    >
                      {disponible}
                    </p>
                  </div>
                </div>

                {puedeTopes && tope && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <EditTopeInline
                      topeId={tope.id}
                      obraId={params.id}
                      materialId={s.material_id}
                      cantidadActual={Number(tope.cantidad_contratada)}
                    />
                  </div>
                )}
              </div>
            )
          })}

          {saldos?.length === 0 && (
            <p className="card py-8 text-center text-gray-500">
              Todavía no hay materiales asignados para este proyecto.
            </p>
          )}
        </div>
      </div>

      {/* SECCIÓN 2: INFORMACIÓN ADICIONAL Y DOCUMENTACIÓN PDF */}
      <section className="pt-2 border-t border-gray-200">
        <ObraDocumentos
          obraId={params.id}
          documentos={documentos}
          puedeGestionar={puedeGestionarDocs}
          puedeEliminar={puedeEliminarDocs}
        />
      </section>
    </main>
  )
}
