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
                <div className="flex justify-between gap-2 items-start">
                  <div>
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
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
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
                  <div className="rounded-lg bg-amber-50 py-2 px-1">
                    <p className="text-amber-800">Pendiente</p>
                    <p className="font-bold text-amber-950 tabular-nums">
                      {pendiente} {m.unidad_medida}
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
