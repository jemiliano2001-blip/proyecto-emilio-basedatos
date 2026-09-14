import { notFound, redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'
import { ReportarInstalacionForm } from '@/components/ReportarInstalacionForm'
import { IconPaquete } from '@/components/icons'
import { getSessionUsuario } from '@/lib/auth/session'
import {
  puedeReportarInstalacion,
  puedeVerInventarioCampo,
} from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'

interface InventarioDetalle {
  obra_id: string
  material_id: string
  nombre_base: string
  variante: string | null
  unidad_medida: string
  categoria: string | null
  cantidad_recibida: number
  cantidad_instalada: number
  cantidad_pendiente_instalar: number
}

export default async function InventarioObraPage({
  params,
}: {
  params: Promise<{ obraId: string }>
}) {
  const { obraId } = await params
  const session = await getSessionUsuario()
  if (!session || !puedeVerInventarioCampo(session.rol)) {
    redirect('/solicitudes')
  }

  const puedeReportar = puedeReportarInstalacion(session.rol)
  const supabase = await createClient()

  const { data: obra } = await supabase
    .from('obras')
    .select('id, nombre, fraccionamiento')
    .eq('id', obraId)
    .maybeSingle()

  if (!obra) notFound()

  const { data: inv } = await supabase
    .from('v_inventario_campo_obra')
    .select(
      `obra_id, material_id, nombre_base, variante, unidad_medida, categoria,
       cantidad_recibida, cantidad_instalada, cantidad_pendiente_instalar`
    )
    .eq('obra_id', obraId)
    .order('nombre_base')

  const lista = (inv ?? []) as InventarioDetalle[]
  const materialesConPendiente = lista.filter(
    (m) => Number(m.cantidad_pendiente_instalar) > 0
  ).length
  const materialesTotales = lista.length
  const progresoPct =
    materialesTotales > 0
      ? Math.round(
          ((materialesTotales - materialesConPendiente) / materialesTotales) * 100
        )
      : 0

  return (
    <main className="page-shell">
      <PageHeader
        title={obra.nombre}
        subtitle={
          obra.fraccionamiento
            ? `${obra.fraccionamiento} · Recibido · Instalado · Pendiente`
            : 'Recibido en sitio · Instalado · Pendiente'
        }
        backHref="/inventario"
        backLabel="Inventario"
      />

      {lista.length > 0 && (
        <section className="card mb-4 bg-gradient-to-br from-white to-teal-50/40 border-teal-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            Pendiente de instalar
          </p>
          <p className="mt-1 text-3xl font-black tabular-nums text-ink leading-none">
            {materialesConPendiente}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            {materialesConPendiente === 1
              ? '1 material con saldo por instalar'
              : `${materialesConPendiente} materiales con saldo por instalar`}
          </p>
          <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-[width]"
              style={{ width: `${progresoPct}%` }}
              role="progressbar"
              aria-valuenow={progresoPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Materiales sin pendiente de instalar"
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {materialesTotales - materialesConPendiente} de {materialesTotales} materiales
            sin pendiente ({progresoPct}%)
          </p>
        </section>
      )}

      {lista.length === 0 ? (
        <EmptyState
          icon={IconPaquete}
          title="Sin material recibido"
          description="Todavía no hay recepciones aprobadas para este proyecto."
        />
      ) : (
        <div className="card divide-y divide-gray-100 p-0 overflow-hidden">
          {lista.map((m) => {
            const pendiente = Number(m.cantidad_pendiente_instalar)
            return (
              <div key={m.material_id} className="p-4 space-y-2">
                <div className="flex justify-between gap-3 items-start">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">
                      {m.nombre_base}
                      {m.variante ? (
                        <span className="text-gray-500 font-normal">
                          {' '}
                          · {m.variante}
                        </span>
                      ) : null}
                    </p>
                    {m.categoria && (
                      <p className="text-[11px] text-gray-400 uppercase tracking-wide">
                        {m.categoria}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] font-semibold uppercase text-amber-800">
                      Pendiente
                    </p>
                    <p className="text-xl font-black tabular-nums text-amber-950 leading-none">
                      {pendiente}
                    </p>
                    <p className="text-[11px] text-gray-500">{m.unidad_medida}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-slate-50 py-2 px-1">
                    <p className="text-gray-500">Recibido</p>
                    <p className="font-bold text-ink tabular-nums">
                      {Number(m.cantidad_recibida)} {m.unidad_medida}
                    </p>
                  </div>
                  <div className="rounded-lg bg-teal-50 py-2 px-1">
                    <p className="text-teal-800">Instalado</p>
                    <p className="font-bold text-teal-900 tabular-nums">
                      {Number(m.cantidad_instalada)} {m.unidad_medida}
                    </p>
                  </div>
                </div>
                {puedeReportar && (
                  <ReportarInstalacionForm
                    key={`${m.material_id}-${pendiente}`}
                    obraId={obraId}
                    materialId={m.material_id}
                    pendiente={pendiente}
                    unidad={m.unidad_medida}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
