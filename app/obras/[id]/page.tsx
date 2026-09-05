import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { IconPlus, IconDocumento, IconPaquete } from '@/components/icons'
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
    .select('id, nombre, cliente, ciudad, fraccionamiento, paquete, ubicacion, estado, presupuesto_mxn')
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

  interface DocumentoDbRow {
    id: string
    obra_id: string
    nombre: string
    tipo_documento: import('@/lib/types').TipoDocumentoObra
    archivo_path: string
    archivo_url: string
    tamano_bytes: number | null
    subido_por: string | null
    creado_en: string
    usuarios?: { nombre: string | null } | null
  }

  const rawDocs = (documentosRaw ?? []) as unknown as DocumentoDbRow[]
  const documentos: ObraDocumento[] = rawDocs.map((d) => ({
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
      <PageHeader
        title={obra.nombre}
        backHref="/"
        backLabel="Proyectos"
        badge={
          <Badge
            variant={
              obra.estado === 'activa'
                ? 'teal'
                : obra.estado === 'pausada'
                ? 'amber'
                : 'gray'
            }
          >
            {labelEstatus(obra.estado)}
          </Badge>
        }
        description={
          <div>
            {obra.cliente && <p className="text-sm font-medium text-gray-700">Cliente: {obra.cliente}</p>}
            {(obra.ciudad || obra.fraccionamiento) && (
              <p className="text-sm text-gray-500">
                {[obra.ciudad, obra.fraccionamiento].filter(Boolean).join(' · ')}
              </p>
            )}
            {obra.ubicacion && (
              <p className="text-xs text-gray-500 mt-0.5">Ubicación: {obra.ubicacion}</p>
            )}
          </div>
        }
        actions={
          puedeEditarObra ? (
            <Link href={`/obras/${params.id}/editar`} className="btn-secondary px-4 py-2 text-sm">
              Editar
            </Link>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2 -mt-2">
        {verConciliacion && (
          <Link href={`/obras/${params.id}/conciliacion`} className="btn-secondary px-4 py-2 text-sm">
            Conciliación
          </Link>
        )}
        <a
          href="#documentos"
          className="btn-secondary px-3 py-2 text-sm inline-flex items-center gap-1.5 text-accent"
        >
          <IconDocumento className="w-4 h-4" />
          <span>Documentos / PDFs</span>
          <span className="badge-teal">
            {documentos.length}
          </span>
        </a>
        <CierreObraAcciones
          obraId={obra.id}
          estado={obra.estado}
          puedeCerrar={puedeCerrar}
          puedeReabrir={puedeReabrir}
        />
      </div>

      {puedeSolicitar && obra.estado === 'activa' && (
        <Link
          href={`/solicitudes/nueva?obra=${params.id}`}
          className="btn-primary flex items-center justify-center gap-2 w-full text-center"
        >
          <IconPlus className="w-4 h-4" />
          <span>Solicitar material</span>
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

      {/* SECCIÓN DOCUMENTACIÓN ADICIONAL Y ARCHIVOS PDF */}
      <section id="documentos" className="card border-slate-200">
        <ObraDocumentos
          obraId={params.id}
          documentos={documentos}
          puedeGestionar={puedeGestionarDocs}
          puedeEliminar={puedeEliminarDocs}
        />
      </section>

      {/* SECCIÓN SALDO Y ESTATUS DE MATERIALES */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Saldo y Estatus de Materiales
            </h2>
            <p className="text-xs text-gray-400">
              Flujo: Asignado → En proceso de compra → Comprado → Entregado en obra.
            </p>
          </div>
          {puedeTopes && (
            <Link
              href={`/obras/${params.id}/asignar-materiales`}
              className="btn-primary shrink-0 text-xs px-3 py-2 min-h-[38px] inline-flex items-center gap-1.5"
            >
              <IconPlus className="w-3.5 h-3.5" />
              <span>Asignar materiales</span>
            </Link>
          )}
        </div>

        <div className="space-y-2">
          {(saldos as SaldoMaterialObra[] | null)?.map((s) => {
            const tope = topePorMaterial.get(s.material_id)
            const asignado = Number(s.cantidad_asignada ?? s.cantidad_contratada ?? 0)
            const enProceso = Number(s.cantidad_en_proceso ?? s.cantidad_comprometida ?? 0)
            const comprado = Number(s.cantidad_comprada ?? 0)
            const entregado = Number(s.cantidad_entregada ?? s.cantidad_usada ?? 0)
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
                    <Badge variant="red">
                      Sin saldo
                    </Badge>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div className="bg-slate-50 p-2 rounded">
                    <p className="text-gray-500 font-medium">Asignado</p>
                    <p className="tabular-nums font-semibold text-gray-900 text-sm mt-0.5">{asignado}</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded">
                    <p className="text-gray-500 font-medium">En proceso</p>
                    <p className="tabular-nums font-semibold text-gray-900 text-sm mt-0.5">{enProceso}</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded">
                    <p className="text-gray-500 font-medium">Comprado</p>
                    <p className="tabular-nums font-semibold text-gray-900 text-sm mt-0.5">{comprado}</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded">
                    <p className="text-gray-500 font-medium">Entregado</p>
                    <p className="tabular-nums font-semibold text-gray-900 text-sm mt-0.5">{entregado}</p>
                  </div>
                  <div className={`p-2 rounded col-span-2 sm:col-span-1 ${sinSaldo ? 'bg-red-100/70' : 'bg-teal-50'}`}>
                    <p className={`font-semibold ${sinSaldo ? 'text-red-700' : 'text-teal-800'}`}>Disponible</p>
                    <p className={`tabular-nums font-bold text-sm mt-0.5 ${sinSaldo ? 'text-red-600' : 'text-teal-700'}`}>
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
            <EmptyState
              icon={IconPaquete}
              title="Sin materiales asignados"
              description="Todavía no hay materiales asignados en el presupuesto de este proyecto."
              action={
                puedeTopes
                  ? {
                      label: 'Asignar materiales',
                      href: `/obras/${params.id}/asignar-materiales`,
                    }
                  : undefined
              }
            />
          )}
        </div>
      </div>
    </main>
  )
}
