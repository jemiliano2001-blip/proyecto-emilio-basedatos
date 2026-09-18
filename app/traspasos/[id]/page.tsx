import { notFound, redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/Badge'
import { CopyButton } from '@/components/CopyButton'
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

function badgeVariant(estado: EstadoTraspaso): 'teal' | 'navy' | 'amber' | 'gray' {
  switch (estado) {
    case 'completado':
      return 'teal'
    case 'en_transito':
      return 'navy'
    case 'solicitado':
      return 'amber'
    case 'rechazado':
    case 'cancelado':
    default:
      return 'gray'
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

  return (
    <main className="page-shell space-y-6">
      <PageHeader
        title={`Traspaso ${data.folio}`}
        backHref="/traspasos"
        backLabel="Volver a Traspasos"
        description={
          <div className="flex items-center gap-2 mt-1">
            <span>Solicitado el {fechaCreacion}</span>
            <CopyButton text={data.folio} label="Copiar folio" className="text-[11px]" />
          </div>
        }
        badge={
          <Badge variant={badgeVariant(data.estado)}>
            {String(data.estado ?? '').replace(/_/g, ' ')}
          </Badge>
        }
      />

      {/* Botones de acción dinámica */}
      <TraspasoAcciones
        traspasoId={data.id}
        estado={data.estado}
        esSolicitante={esSolicitante}
        puedeAprobar={puedeAprobar}
        puedeConfirmar={puedeConfirmar}
        puedeCancelar={puedeCancelar}
      />

      {/* Tarjeta de Origen y Destino */}
      <div className="card grid grid-cols-2 gap-4">
        <div className="border-r border-border pr-2">
          <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">
            Proyecto origen (salida)
          </span>
          <p className="text-sm font-bold text-foreground mt-1">
            {data.obra_origen?.nombre ?? 'N/A'}
          </p>
          {data.obra_origen?.fraccionamiento && (
            <p className="text-xs text-muted-foreground">{data.obra_origen.fraccionamiento}</p>
          )}
        </div>

        <div>
          <span className="text-[10px] uppercase font-bold text-muted-foreground block tracking-wider">
            Proyecto destino (entrada)
          </span>
          <p className="text-sm font-bold text-foreground mt-1">
            {data.obra_destino?.nombre ?? 'N/A'}
          </p>
          {data.obra_destino?.fraccionamiento && (
            <p className="text-xs text-muted-foreground">{data.obra_destino.fraccionamiento}</p>
          )}
        </div>
      </div>

      {/* Observaciones */}
      {data.motivo && (
        <div className="bg-warning-soft border border-warning/30 p-3 rounded-xl text-xs text-warning-soft-foreground">
          <span className="font-semibold block mb-0.5">Motivo / Observaciones:</span>
          {data.motivo}
        </div>
      )}

      {/* Lista de Materiales */}
      <div className="card space-y-3">
        <h2 className="font-bold text-foreground text-sm border-b pb-2">
          Materiales a Traspasar
        </h2>

        <div className="divide-y divide-border">
          {data.items?.map((item) => (
            <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
              <div>
                <p className="font-semibold text-foreground text-sm">
                  {item.material?.nombre_base}{' '}
                  {item.material?.variante ? `(${item.material.variante})` : ''}
                </p>
                <p className="text-muted-foreground text-[11px]">Unidad: {item.material?.unidad_medida}</p>
              </div>
              <div className="text-right">
                <span className="text-base font-bold text-foreground">
                  {item.cantidad}
                </span>{' '}
                <span className="text-muted-foreground text-xs">{item.material?.unidad_medida}</span>
                {verPrecios && item.precio_unitario_mxn ? (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {formatMoneyMx(item.precio_unitario_mxn)} c/u ={' '}
                    <strong>{formatMoneyMx(item.cantidad * item.precio_unitario_mxn)}</strong>
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {verPrecios && (
          <div className="border-t pt-3 mt-1 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-foreground">
                Valor del traspaso
                {data.estado === 'solicitado' && (
                  <span className="font-normal text-muted-foreground text-xs">
                    {' '}(se calcula al aprobar)
                  </span>
                )}
              </span>
              <span className="font-bold text-foreground">{formatMoneyMx(montoTotal)}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Al completarse, este monto se le abona a{' '}
              <strong>{data.obra_origen?.nombre ?? 'el proyecto origen'}</strong> y se le carga a{' '}
              <strong>{data.obra_destino?.nombre ?? 'el proyecto destino'}</strong>.
            </p>
            {haySinPrecio && (
              <p className="text-[11px] text-warning-soft-foreground bg-warning-soft border border-warning/30 rounded p-2">
                Algún material no tiene precio de compra registrado en el sistema, así que
                entra valuado en $0 y no mueve presupuesto.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Historial / Trazabilidad */}
      <div className="card space-y-2 text-xs">
        <h2 className="font-bold text-foreground text-sm border-b pb-2 mb-3">
          Historial de Trazabilidad
        </h2>

        <div className="flex items-start gap-3 text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-warning mt-1.5 shrink-0" />
          <div>
            <p className="font-semibold text-foreground">Solicitado</p>
            <p className="text-muted-foreground">Por {data.solicitante?.nombre ?? 'Anónimo'} el {fechaCreacion}</p>
          </div>
        </div>

        {fechaAprobacion && (
          <div className="flex items-start gap-3 text-muted-foreground pt-2 border-t border-border">
            <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
            <div>
              <p className="font-semibold text-foreground">Aprobado (En tránsito)</p>
              <p className="text-muted-foreground">
                Por {data.aprobador?.nombre ?? 'Sistema'} el {fechaAprobacion}
              </p>
            </div>
          </div>
        )}

        {fechaRecepcion && (
          <div className="flex items-start gap-3 text-muted-foreground pt-2 border-t border-border">
            <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
            <div>
              <p className="font-semibold text-foreground">Completado (Recibido)</p>
              <p className="text-muted-foreground">
                Por {data.receptor?.nombre ?? 'Sistema'} el {fechaRecepcion}
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
