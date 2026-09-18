import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'
import { SolicitudForm } from '@/components/SolicitudForm'
import { createSolicitudAction } from '@/lib/actions/solicitudes'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeCrearSolicitudes, puedeCrearSolicitudMultiObra } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'

export default async function NuevaSolicitudPage({
  searchParams,
}: {
  searchParams: Promise<{ obra?: string }>
}) {
  const resolvedsearchParams = await searchParams
  const session = await getSessionUsuario()
  if (!session || !puedeCrearSolicitudes(session.rol)) {
    redirect('/solicitudes')
  }

  const supabase = await createClient()

  const { data: obras } = await supabase
    .from('obras')
    .select('id, nombre, fraccionamiento')
    .eq('estado', 'activa')
    .order('nombre')

  const { data: materiales } = await supabase
    .from('catalogo_materiales')
    .select('id, nombre_base, variante, unidad_medida, categoria, subcategoria, precio_base')
    .eq('activo', true)
    .order('nombre_base')

  // Saldos de materiales por obra para validación en tiempo real en UI
  const { data: saldosRaw } = await supabase
    .from('v_saldo_material_obra')
    .select('obra_id, material_id, cantidad_disponible, cantidad_comprometida, cantidad_en_proceso')

  // Obtener cantidades de solicitudes pendientes de aprobación para deducción provisional en tiempo real
  const { data: itemsPendientes } = await supabase
    .from('solicitud_items')
    .select('material_id, obra_id, cantidad_solicitada, solicitud:solicitudes_material!inner(id, obra_id, estado)')
    .in('solicitud.estado', ['recibida', 'pendiente'])

  const pendientesMap = new Map<string, number>()
  for (const item of itemsPendientes ?? []) {
    const solicitudData = Array.isArray(item.solicitud) ? item.solicitud[0] : item.solicitud
    const itemObraId = item.obra_id || solicitudData?.obra_id
    if (itemObraId && item.material_id && item.cantidad_solicitada) {
      const key = `${itemObraId}_${item.material_id}`
      pendientesMap.set(key, (pendientesMap.get(key) ?? 0) + Number(item.cantidad_solicitada))
    }
  }

  const saldos = (saldosRaw ?? []).map((s) => {
    const key = `${s.obra_id}_${s.material_id}`
    const pendiente = pendientesMap.get(key) ?? 0
    const rawDisp = Number(s.cantidad_disponible ?? 0)
    const rawComp = Number(s.cantidad_comprometida ?? s.cantidad_en_proceso ?? 0)
    // Garantizar que la reserva provisional esté descontada y reflejada
    const yaIncluido = rawComp >= pendiente && pendiente > 0
    const cantidad_disponible = Math.max(0, Math.round((rawDisp - (yaIncluido ? 0 : pendiente)) * 100) / 100)
    const cantidad_comprometida = Math.round((rawComp + (yaIncluido ? 0 : pendiente)) * 100) / 100

    return {
      obra_id: s.obra_id,
      material_id: s.material_id,
      cantidad_disponible,
      cantidad_comprometida,
    }
  })

  return (
    <main className="page-shell-narrow">
      <PageHeader
        title="Solicitud para requisición de materiales"
        description="Elige el proyecto y agrega las partidas de materiales. Solo se listan materiales con saldo presupuestal disponible en la obra."
        backHref="/solicitudes"
        backLabel="Solicitudes"
      />

      {!obras?.length ? (
        <EmptyState
          title="No hay proyectos activos"
          description="Debes tener al menos un proyecto activo para poder solicitar materiales."
          action={{ label: 'Crear proyecto', href: '/obras/nueva' }}
        />
      ) : (
        <SolicitudForm
          action={createSolicitudAction}
          obras={obras}
          materiales={materiales ?? []}
          saldos={saldos}
          defaultObraId={resolvedsearchParams.obra}
          permiteMultiObra={puedeCrearSolicitudMultiObra(session.rol)}
        />
      )}
    </main>
  )
}
