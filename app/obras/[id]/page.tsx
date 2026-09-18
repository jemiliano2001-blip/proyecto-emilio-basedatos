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
  const totalMx = Number(presupuesto?.presupuesto_mxn ?? obra.presupuesto_mxn ?? 0)
  const comprometidoMx = Number(presupuesto?.comprometido_mxn ?? 0)
  const gastadoMx = Number(presupuesto?.gastado_mxn ?? 0)
  const disponibleMx = Number(presupuesto?.disponible_mxn ?? obra.presupuesto_mxn ?? 0)
  const pct = (v: number) => (totalMx > 0 ? Math.min(100, Math.max(0, (v / totalMx) * 100)) : 0)
  const meta = [obra.ciudad, obra.fraccionamiento].filter(Boolean).join(' · ')
  const eyebrow = [obra.cliente ? `Cliente: ${obra.cliente}` : null, meta || null]
    .filter(Boolean)
    .join(' · ')

  return (
    <main className="page-shell-wide">
      <PageHeader
        title={obra.nombre}
        backHref="/"
        backLabel="Proyectos"
        eyebrow={eyebrow || undefined}
        badge={
          <Badge
            variant={
              obra.estado === 'activa' ? 'success' : obra.estado === 'pausada' ? 'warning' : 'neutral'
            }
            dot
          >
            {labelEstatus(obra.estado)}
          </Badge>
        }
        description={obra.ubicacion ? `Ubicación: ${obra.ubicacion}` : undefined}
        actions={
          <>
            {puedeEditarObra && (
              <Link href={`/obras/${resolvedparams.id}/editar`} className="btn-secondary btn-sm">
                Editar
              </Link>
            )}
            {verConciliacion && (
              <Link href={`/obras/${resolvedparams.id}/conciliacion`} className="btn-secondary btn-sm">
                Conciliación
              </Link>
            )}
            {puedeSolicitar && obra.estado === 'activa' && (
              <Link href={`/solicitudes/nueva?obra=${resolvedparams.id}`} className="btn-primary btn-sm">
                <IconPlus className="size-4" />
                Solicitar material
              </Link>
            )}
          </>
        }
      />

      {obra.foto_url && (
        <div className="relative mb-6 h-40 overflow-hidden rounded-xl border border-border bg-muted sm:h-52">
          <Image src={obra.foto_url} alt={obra.nombre} fill unoptimized className="object-cover" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        {/* Columna principal */}
        <div className="min-w-0 space-y-6">
          {/* Presupuesto en móvil/tablet (en desktop vive en el rail) */}
          {verPrecios && (
            <section className="card lg:hidden">
              <PresupuestoResumen
                total={totalMx}
                comprometido={comprometidoMx}
                gastado={gastadoMx}
                disponible={disponibleMx}
                pct={pct}
              />
            </section>
          )}

          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">Materiales y saldo</h2>
                <p className="text-sm text-muted-foreground">
                  Asignado → En proceso de compra → Comprado → Entregado en obra.
                </p>
              </div>
              {puedeTopes && (
                <Link
                  href={`/obras/${resolvedparams.id}/asignar-materiales`}
                  className="btn-secondary btn-sm"
                >
                  <IconPlus className="size-4" />
                  Asignar materiales
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
          </section>

          <section id="documentos" className="card">
            <ObraDocumentos
              obraId={resolvedparams.id}
              documentos={documentos}
              puedeGestionar={puedeGestionarDocs}
              puedeEliminar={puedeEliminarDocs}
            />
          </section>
        </div>

        {/* Rail derecho */}
        <aside className="space-y-4 lg:sticky lg:top-[calc(var(--topbar-height)+1.5rem)]">
          {verPrecios && (
            <section className="card hidden lg:block">
              <PresupuestoResumen
                total={totalMx}
                comprometido={comprometidoMx}
                gastado={gastadoMx}
                disponible={disponibleMx}
                pct={pct}
              />
            </section>
          )}

          <section className="card">
            <h2 className="card-title mb-3">Resumen</h2>
            <dl className="space-y-2.5 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">Estatus</dt>
                <dd className="font-medium text-foreground">{labelEstatus(obra.estado)}</dd>
              </div>
              {obra.cliente && (
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Cliente</dt>
                  <dd className="text-right font-medium text-foreground">{obra.cliente}</dd>
                </div>
              )}
              {meta && (
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Ubicación</dt>
                  <dd className="text-right font-medium text-foreground">{meta}</dd>
                </div>
              )}
              {obra.paquete && (
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Paquete</dt>
                  <dd className="text-right font-medium text-foreground">{obra.paquete}</dd>
                </div>
              )}
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">Materiales</dt>
                <dd className="font-medium text-foreground tabular-nums">{(saldos ?? []).length}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">Documentos</dt>
                <dd className="font-medium tabular-nums">
                  <a href="#documentos" className="inline-flex items-center gap-1 text-primary hover:underline">
                    <IconDocumento className="size-3.5" />
                    {documentos.length}
                  </a>
                </dd>
              </div>
            </dl>
          </section>

          {(puedeCerrar || puedeReabrir) && (
            <section className="card border-dashed">
              <h2 className="card-title mb-1">Ciclo de vida</h2>
              <p className="mb-3 text-xs text-muted-foreground">
                Cerrar el proyecto congela saldos y genera la conciliación final.
              </p>
              <CierreObraAcciones
                obraId={obra.id}
                estado={obra.estado}
                puedeCerrar={puedeCerrar}
                puedeReabrir={puedeReabrir}
              />
            </section>
          )}
        </aside>
      </div>
    </main>
  )
}

function PresupuestoResumen({
  total,
  comprometido,
  gastado,
  disponible,
  pct,
}: {
  total: number
  comprometido: number
  gastado: number
  disponible: number
  pct: (v: number) => number
}) {
  const filas = [
    { label: 'Gastado', value: gastado, bar: 'bg-foreground', highlight: false },
    { label: 'Comprometido', value: comprometido, bar: 'bg-warning', highlight: false },
    { label: 'Disponible', value: disponible, bar: 'bg-primary', highlight: true },
  ]
  return (
    <>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="card-title">Presupuesto</h2>
          <p className="text-xs text-muted-foreground">MXN · tope contratado</p>
        </div>
        <p className="text-right text-lg font-semibold tabular-nums text-foreground">{formatMoneyMx(total)}</p>
      </div>
      {/* Barra apilada: gastado + comprometido sobre el total */}
      <div className="mb-4 flex h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        <span className="h-full bg-foreground" style={{ width: `${pct(gastado)}%` }} />
        <span className="h-full bg-warning" style={{ width: `${pct(comprometido)}%` }} />
      </div>
      <dl className="space-y-2">
        {filas.map((f) => (
          <div key={f.label} className="flex items-center justify-between gap-3 text-sm">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <span className={`size-2 rounded-full ${f.bar}`} aria-hidden />
              {f.label}
            </dt>
            <dd className={`tabular-nums font-semibold ${f.highlight ? 'text-primary' : 'text-foreground'}`}>
              {formatMoneyMx(f.value)}
            </dd>
          </div>
        ))}
      </dl>
    </>
  )
}
