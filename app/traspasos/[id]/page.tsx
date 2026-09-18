import { notFound, redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/Badge'
import { CopyButton } from '@/components/CopyButton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { IconAlerta, IconInfo, IconTraspasos } from '@/components/icons'
import { TraspasoAcciones } from '@/components/TraspasoAcciones'
import { getSessionUsuario } from '@/lib/auth/session'
import { formatMoneyMx } from '@/lib/money'
import {
  puedeAprobarTraspaso,
  puedeCancelarTraspaso,
  puedeConfirmarTraspaso,
  puedeVerTraspasos,
  puedeVerPrecios,
} from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { esRelacionAusente } from '@/lib/schema-disponible'
import type { EstadoTraspaso } from '@/lib/types'
import { cn } from '@/lib/utils'

interface TraspasoDetalle {
  id: string
  folio: string
  estado: EstadoTraspaso
  motivo: string | null
  creado_en: string
  aprobado_en: string | null
  recibido_en: string | null
  solicitante_id: string
  obra_origen: { nombre: string; fraccionamiento: string | null } | null
  obra_destino: { nombre: string; fraccionamiento: string | null } | null
  solicitante: { nombre: string } | null
  aprobador: { nombre: string } | null
  receptor: { nombre: string } | null
  items: {
    id: string
    cantidad: number
    precio_unitario_mxn: number | null
    material: { nombre_base: string; variante: string | null; unidad_medida: string } | null
  }[]
}

function badgeVariant(estado: EstadoTraspaso): 'success' | 'info' | 'warning' | 'danger' | 'neutral' {
  switch (estado) {
    case 'completado':
      return 'success'
    case 'en_transito':
      return 'info'
    case 'solicitado':
      return 'warning'
    case 'rechazado':
      return 'danger'
    case 'cancelado':
    default:
      return 'neutral'
  }
}

function labelEstado(estado: EstadoTraspaso): string {
  switch (estado) {
    case 'completado':
      return 'Completado'
    case 'en_transito':
      return 'En tránsito'
    case 'solicitado':
      return 'Solicitado'
    case 'rechazado':
      return 'Rechazado'
    case 'cancelado':
      return 'Cancelado'
    default:
      return String(estado ?? '').replace(/_/g, ' ')
  }
}

export default async function TraspasoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedparams = await params
  const session = await getSessionUsuario()
  if (!session || !puedeVerTraspasos(session.rol)) {
    redirect('/solicitudes')
  }
  const supabase = await createClient()

  const { data: traspaso, error } = await supabase
    .from('traspasos_obra')
    .select(
      `
      id,
      folio,
      estado,
      motivo,
      creado_en,
      aprobado_en,
      recibido_en,
      solicitante_id,
      obra_origen:obras!obra_origen_id(nombre, fraccionamiento),
      obra_destino:obras!obra_destino_id(nombre, fraccionamiento),
      solicitante:usuarios!solicitante_id(nombre),
      aprobador:usuarios!aprobador_id(nombre),
      receptor:usuarios!receptor_id(nombre),
      items:traspaso_items(
        id,
        cantidad,

        material:catalogo_materiales(nombre_base, variante, unidad_medida)
      )
    `
    )
    .eq('id', resolvedparams.id)
    .single()

  if (error || !traspaso) {
    notFound()
  }

  const data = traspaso as unknown as TraspasoDetalle

  const esSolicitante = session?.perfil?.id === data.solicitante_id
  const puedeAprobar = puedeAprobarTraspaso(session?.rol ?? null)
  const puedeConfirmar = puedeConfirmarTraspaso(session?.rol ?? null)
  const puedeCancelar = puedeCancelarTraspaso(session?.rol ?? null)
  const verPrecios = puedeVerPrecios(session?.rol ?? null)

  if (verPrecios) {
    const { data: precios, error: preciosError } = await supabase.rpc('precios_traspaso', { p_traspaso_id: resolvedparams.id })
    if (preciosError && !esRelacionAusente(preciosError)) {
      throw new Error('No se pudieron cargar los precios del traspaso.')
    }
    if (precios) {
      const porId = new Map((precios as { id: string; precio_unitario_mxn: number | null }[]).map(p => [p.id, p.precio_unitario_mxn]))
      data.items = data.items.map(item => ({ ...item, precio_unitario_mxn: porId.get(item.id) ?? null }))
    }
  }

  // Valuación congelada al aprobar. Mientras el traspaso está 'solicitado'
  // todavía no hay precios y el total es 0.
  const montoTotal = (data.items ?? []).reduce(
    (acc, item) => acc + item.cantidad * (item.precio_unitario_mxn ?? 0),
    0
  )
  const haySinPrecio = (data.items ?? []).some(
    (item) => data.estado !== 'solicitado' && !item.precio_unitario_mxn
  )

  const fechaCreacion = new Date(data.creado_en).toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const fechaAprobacion = data.aprobado_en
    ? new Date(data.aprobado_en).toLocaleString('es-MX', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null
  const fechaRecepcion = data.recibido_en
    ? new Date(data.recibido_en).toLocaleString('es-MX', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null

  const hayAcciones =
    (data.estado === 'solicitado' && (puedeAprobar || esSolicitante || puedeCancelar)) ||
    (data.estado === 'en_transito' && (puedeConfirmar || puedeAprobar))

  const pasos: { label: string; detalle: string; hecho: boolean; tono: string }[] = [
    {
      label: 'Solicitado',
      detalle: `${data.solicitante?.nombre ?? 'Anónimo'} · ${fechaCreacion}`,
      hecho: true,
      tono: 'bg-warning',
    },
    {
      label: data.estado === 'rechazado' ? 'Rechazado' : 'Aprobado · en tránsito',
      detalle: fechaAprobacion ? `${data.aprobador?.nombre ?? 'Sistema'} · ${fechaAprobacion}` : 'Pendiente de Compras',
      hecho: Boolean(fechaAprobacion) || data.estado === 'rechazado',
      tono: data.estado === 'rechazado' ? 'bg-danger' : 'bg-primary',
    },
    {
      label: 'Completado · recibido',
      detalle: fechaRecepcion ? `${data.receptor?.nombre ?? 'Sistema'} · ${fechaRecepcion}` : 'Pendiente de recepción en destino',
      hecho: Boolean(fechaRecepcion),
      tono: 'bg-success',
    },
  ]

  return (
    <main className="page-shell-wide">
      <PageHeader
        eyebrow={`Traspaso · solicitado el ${fechaCreacion}`}
        title={
          <span className="inline-flex items-center gap-2">
            <span className="tabular-nums">{data.folio}</span>
            <CopyButton text={data.folio} label="Copiar folio" />
          </span>
        }
        backHref="/traspasos"
        backLabel="Traspasos"
        description={`${data.obra_origen?.nombre ?? 'Origen'} → ${data.obra_destino?.nombre ?? 'Destino'}`}
        badge={
          <Badge variant={badgeVariant(data.estado)} dot>
            {labelEstado(data.estado)}
          </Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        {/* Columna principal */}
        <div className="min-w-0 space-y-6">
          {/* Origen → destino */}
          <section className="card grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sale de</p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground">
                {data.obra_origen?.nombre ?? 'N/A'}
              </p>
              {data.obra_origen?.fraccionamiento && (
                <p className="truncate text-xs text-muted-foreground">{data.obra_origen.fraccionamiento}</p>
              )}
            </div>
            <div className="flex items-center justify-center text-muted-foreground" aria-hidden>
              <span className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-primary">
                <IconTraspasos className="size-4" />
              </span>
            </div>
            <div className="min-w-0 sm:text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Entra a</p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground">
                {data.obra_destino?.nombre ?? 'N/A'}
              </p>
              {data.obra_destino?.fraccionamiento && (
                <p className="truncate text-xs text-muted-foreground">{data.obra_destino.fraccionamiento}</p>
              )}
            </div>
          </section>

          {data.motivo && (
            <Alert variant="warning">
              <IconInfo />
              <AlertTitle>Motivo / observaciones</AlertTitle>
              <AlertDescription>{data.motivo}</AlertDescription>
            </Alert>
          )}

          {/* Materiales */}
          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Materiales a traspasar</h2>
              <p className="text-sm text-muted-foreground">
                {data.items?.length ?? 0} partida{(data.items?.length ?? 0) === 1 ? '' : 's'}
                {verPrecios ? ' · el precio se congela al aprobar' : ''}
              </p>
            </div>
            <div className="list-stack">
              <div
                className={cn(
                  'list-header',
                  verPrecios
                    ? 'lg:grid-cols-[minmax(0,1fr)_7rem_8rem_8rem]'
                    : 'lg:grid-cols-[minmax(0,1fr)_7rem]'
                )}
              >
                <span>Material</span>
                <span className="text-right">Cantidad</span>
                {verPrecios && (
                  <>
                    <span className="text-right">P. unitario</span>
                    <span className="text-right">Importe</span>
                  </>
                )}
              </div>
              {data.items?.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center justify-between gap-3 px-4 py-3 lg:grid lg:gap-3',
                    verPrecios
                      ? 'lg:grid-cols-[minmax(0,1fr)_7rem_8rem_8rem]'
                      : 'lg:grid-cols-[minmax(0,1fr)_7rem]'
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {item.material?.nombre_base}
                      {item.material?.variante ? (
                        <span className="text-muted-foreground"> · {item.material.variante}</span>
                      ) : null}
                    </p>
                    {verPrecios && item.precio_unitario_mxn ? (
                      <p className="text-xs text-muted-foreground tabular-nums lg:hidden">
                        {formatMoneyMx(item.precio_unitario_mxn)} c/u
                      </p>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-right text-sm tabular-nums text-foreground">
                    <span className="font-semibold">{item.cantidad}</span>{' '}
                    <span className="text-muted-foreground">{item.material?.unidad_medida}</span>
                  </p>
                  {verPrecios && (
                    <>
                      <p className="hidden text-right text-sm tabular-nums text-muted-foreground lg:block">
                        {item.precio_unitario_mxn ? formatMoneyMx(item.precio_unitario_mxn) : '—'}
                      </p>
                      <p className="hidden text-right text-sm font-semibold tabular-nums text-foreground lg:block">
                        {item.precio_unitario_mxn ? formatMoneyMx(item.cantidad * item.precio_unitario_mxn) : '—'}
                      </p>
                    </>
                  )}
                </div>
              ))}
              {verPrecios && (
                <div className="flex items-center justify-between bg-muted/40 px-4 py-3">
                  <span className="text-sm font-semibold text-foreground">
                    Valor del traspaso
                    {data.estado === 'solicitado' && (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">(se calcula al aprobar)</span>
                    )}
                  </span>
                  <span className="text-base font-semibold tabular-nums text-foreground">{formatMoneyMx(montoTotal)}</span>
                </div>
              )}
            </div>
            {verPrecios && (
              <p className="text-xs text-muted-foreground">
                Al completarse, este monto se abona a{' '}
                <strong className="font-medium text-foreground">{data.obra_origen?.nombre ?? 'el proyecto origen'}</strong> y se
                carga a <strong className="font-medium text-foreground">{data.obra_destino?.nombre ?? 'el proyecto destino'}</strong>.
              </p>
            )}
            {verPrecios && haySinPrecio && (
              <Alert variant="warning">
                <IconAlerta />
                <AlertDescription>
                  Algún material no tiene precio de compra registrado, así que entra valuado en $0 y no mueve
                  presupuesto.
                </AlertDescription>
              </Alert>
            )}
          </section>
        </div>

        {/* Rail derecho */}
        <aside className="space-y-4 lg:sticky lg:top-[calc(var(--topbar-height)+1.5rem)]">
          {hayAcciones && (
            <section className="card">
              <h2 className="card-title mb-3">Acciones</h2>
              <TraspasoAcciones
                traspasoId={data.id}
                estado={data.estado}
                esSolicitante={esSolicitante}
                puedeAprobar={puedeAprobar}
                puedeConfirmar={puedeConfirmar}
                puedeCancelar={puedeCancelar}
              />
            </section>
          )}

          <section className="card">
            <h2 className="card-title mb-3">Trazabilidad</h2>
            <ol className="space-y-3">
              {pasos.map((paso, i) => (
                <li key={paso.label} className="relative flex gap-3 text-sm">
                  <span className="relative flex flex-col items-center">
                    <span
                      className={cn(
                        'mt-1 size-2.5 shrink-0 rounded-full ring-4 ring-card',
                        paso.hecho ? paso.tono : 'bg-border'
                      )}
                    />
                    {i < pasos.length - 1 && <span className="mt-1 w-px flex-1 bg-border" aria-hidden />}
                  </span>
                  <div className="min-w-0 pb-1">
                    <p className={cn('font-medium', paso.hecho ? 'text-foreground' : 'text-muted-foreground')}>
                      {paso.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{paso.detalle}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="card">
            <h2 className="card-title mb-3">Resumen</h2>
            <dl className="space-y-2.5 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">Estatus</dt>
                <dd className="font-medium text-foreground">{labelEstado(data.estado)}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">Solicita</dt>
                <dd className="text-right font-medium text-foreground">{data.solicitante?.nombre ?? '—'}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">Partidas</dt>
                <dd className="font-medium tabular-nums text-foreground">{data.items?.length ?? 0}</dd>
              </div>
              {verPrecios && (
                <div className="flex items-start justify-between gap-3 border-t border-border pt-2.5">
                  <dt className="text-muted-foreground">Valor</dt>
                  <dd className="font-semibold tabular-nums text-foreground">{formatMoneyMx(montoTotal)}</dd>
                </div>
              )}
            </dl>
          </section>
        </aside>
      </div>
    </main>
  )
}
