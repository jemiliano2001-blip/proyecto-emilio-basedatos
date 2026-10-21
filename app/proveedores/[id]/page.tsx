import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { PageHeader } from '@/components/PageHeader'
import { ProveedorForm } from '@/components/ProveedorForm'
import { updateProveedorAction } from '@/lib/actions/proveedores'
import { getSessionUsuario } from '@/lib/auth/session'
import { formatearFechaLista } from '@/lib/fechas'
import { formatMoneyMx } from '@/lib/money'
import { resumirHistorial } from '@/lib/proveedores-lista'
import { puedeGestionarProveedores } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { Proveedor } from '@/lib/types'

interface OrdenProveedor {
  id: string
  folio: string
  estado: string
  total: number | string
  moneda: string
  creado_en: string
}

function varianteEstado(estado: string) {
  if (estado === 'emitida') return 'info'
  if (estado === 'completada' || estado === 'recibida') return 'success'
  if (estado === 'parcialmente_recibida') return 'warning'
  return 'neutral'
}

export default async function EditarProveedorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedparams = await params
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarProveedores(session.rol)) {
    redirect('/proveedores')
  }

  const supabase = await createClient()
  const { data: proveedor } = await supabase
    .from('proveedores')
    .select('id, nombre, contacto, telefono, activo, creado_en')
    .eq('id', resolvedparams.id)
    .maybeSingle()

  if (!proveedor) notFound()

  const { data: ordenesData } = await supabase
    .from('ordenes_compra')
    .select('id, folio, estado, total, moneda, creado_en')
    .eq('proveedor_id', resolvedparams.id)
    .order('creado_en', { ascending: false })
    .limit(200)
  const ordenes = (ordenesData as OrdenProveedor[] | null) ?? []
  const resumen = resumirHistorial(ordenes)
  // El total solo suma pesos: mezclar monedas daría una cifra sin sentido.
  const totalMxn = resumirHistorial(ordenes.filter((o) => o.moneda === 'MXN')).total

  const updateAction = updateProveedorAction.bind(null, resolvedparams.id)

  return (
    <main className="page-shell-narrow">
      <PageHeader
        title={proveedor.nombre}
        subtitle="Ficha del proveedor"
        backHref="/proveedores"
        backLabel="Proveedores"
      />

      <section aria-labelledby="historial-titulo" className="mb-8">
        <h2 id="historial-titulo" className="mb-3 text-base font-semibold text-foreground">
          Historial de compras
        </h2>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="stat-tile col-span-2 sm:col-span-1">
            <p className="stat-label">Comprado (MXN)</p>
            <p className="stat-value tabular-nums">{formatMoneyMx(totalMxn)}</p>
          </div>
          <div className="stat-tile">
            <p className="stat-label">Órdenes</p>
            <p className="stat-value tabular-nums">{resumen.cantidad}</p>
          </div>
          <div className="stat-tile">
            <p className="stat-label">Última compra</p>
            <p className="stat-value text-base tabular-nums">
              {resumen.ultima ? formatearFechaLista(resumen.ultima) : '—'}
            </p>
          </div>
        </div>
        {ordenes.length === 0 ? (
          <p className="card text-sm text-muted-foreground">Aún no hay órdenes con este proveedor.</p>
        ) : (
          <div className="list-stack">
            {ordenes.map((o) => (
              <Link key={o.id} href={`/ordenes/${o.id}`} className="list-row group items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold tabular-nums text-foreground group-hover:text-primary">
                    {o.folio}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <Badge variant={varianteEstado(o.estado)} dot>
                      {o.estado.replaceAll('_', ' ')}
                    </Badge>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {formatearFechaLista(o.creado_en)}
                    </span>
                  </div>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                  {formatMoneyMx(Number(o.total))}{' '}
                  <span className="text-xs font-medium text-muted-foreground">{o.moneda}</span>
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <h2 className="mb-3 text-base font-semibold text-foreground">Datos del proveedor</h2>
      <ProveedorForm
        action={updateAction}
        proveedor={proveedor as Proveedor}
        submitLabel="Guardar cambios"
      />
    </main>
  )
}
