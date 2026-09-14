import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/Badge'
import { IconPlus, IconDocumento } from '@/components/icons'
import { CierreObraAcciones } from '@/components/CierreObraAcciones'
import { ObraDocumentos } from '@/components/ObraDocumentos'
import { ObraMaterialesList } from '@/components/ObraMaterialesList'
import { getSessionUsuario } from '@/lib/auth/session'
import { formatMoneyMx } from '@/lib/money'
import {
  puedeCerrarObra,
  puedeCrearSolicitudes,
  puedeEliminarDocumentos,
  puedeGestionarCatalogo,
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
  params: Promise<{ id: string }>
}) {
  const resolvedparams = await params
  const session = await getSessionUsuario()
  const supabase = await createClient()
  const rol = session?.rol ?? null
  const puedeEditarObra = puedeGestionarObras(rol)
  const puedeEditarCatalogo = puedeGestionarCatalogo(rol)
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
    .select('id, nombre, cliente, ciudad, fraccionamiento, paquete, ubicacion, estado, presupuesto_mxn, foto_url')
    .eq('id', resolvedparams.id)
    .maybeSingle()

  if (!obra) notFound()

  const { data: saldos } = await supabase
    .from('v_saldo_material_obra')
    .select('*')
    .eq('obra_id', resolvedparams.id)
    .order('nombre_base')

  const { data: saldoMx } = verPrecios
    ? await supabase
        .rpc('saldo_presupuesto_proyecto', { p_obra_id: resolvedparams.id })
        .maybeSingle()
    : { data: null }

  const { data: topes } = await supabase
    .from('obra_material_contratado')
    .select('id, material_id, cantidad_contratada')
    .eq('obra_id', resolvedparams.id)

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
    .eq('obra_id', resolvedparams.id)
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
            <Link href={`/obras/${resolvedparams.id}/editar`} className="btn-secondary px-4 py-2 text-sm">
              Editar
            </Link>
          ) : undefined
        }
      />
      {/* FOTOGRAFÍA / PORTADA DEL PROYECTO */}
      {obra.foto_url && (
        <div className="card p-0 overflow-hidden border border-gray-200 shadow-sm relative group">
          <div className="w-full h-44 sm:h-56 bg-slate-900 relative">
            <Image
              src={obra.foto_url}
              alt={obra.nombre}
              fill
              unoptimized
              className="object-cover group-hover:scale-[1.01] transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent flex items-end p-4">
              <span className="text-white text-xs font-semibold px-2.5 py-1 rounded bg-black/50 backdrop-blur-sm">
                Fotografía del Proyecto
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 -mt-2">
        {verConciliacion && (
          <Link href={`/obras/${resolvedparams.id}/conciliacion`} className="btn-secondary px-4 py-2 text-sm">
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
          href={`/solicitudes/nueva?obra=${resolvedparams.id}`}
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
          obraId={resolvedparams.id}
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
              href={`/obras/${resolvedparams.id}/asignar-materiales`}
              className="btn-primary shrink-0 text-sm px-3 py-2 min-h-[44px] inline-flex items-center gap-1.5"
            >
              <IconPlus className="w-3.5 h-3.5" />
              <span>Asignar materiales</span>
            </Link>
          )}
        </div>

        <ObraMaterialesList
          obraId={resolvedparams.id}
          saldos={(saldos as SaldoMaterialObra[] | null) ?? []}
          topes={topes ?? []}
          puedeTopes={puedeTopes}
          verPrecios={verPrecios}
          puedeEditarCatalogo={puedeEditarCatalogo}
        />
      </div>
    </main>
  )
}
