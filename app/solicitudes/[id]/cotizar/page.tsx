import { notFound, redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { CotizarForm } from '@/components/CotizarForm'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeCotizar } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'

export default async function CotizarSolicitudPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedparams = await params
  const session = await getSessionUsuario()
  if (!session || !puedeCotizar(session.rol)) {
    redirect(`/solicitudes/${resolvedparams.id}`)
  }

  const supabase = await createClient()

  const { data: solicitud } = await supabase
    .from('solicitudes_material')
    .select(
      `id, estado,
       obra:obras(nombre),
       items:solicitud_items(
         id, cantidad_solicitada,
         material:catalogo_materiales(nombre_base, variante, unidad_medida)
       )`
    )
    .eq('id', resolvedparams.id)
    .maybeSingle()

  if (!solicitud) notFound()

  const { data: proveedores } = await supabase
    .from('proveedores')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre')

  const { data: cotizaciones } = await supabase
    .from('cotizaciones')
    .select(
      `id, estado,
       items:cotizacion_items(
         id, solicitud_item_id, proveedor_id, precio_unitario, cantidad, moneda
       )`
    )
    .eq('solicitud_id', resolvedparams.id)
    .order('creado_en', { ascending: false })
    .limit(1)

  const cotizacionExistente = cotizaciones?.[0]
    ? {
        id: cotizaciones[0].id as string,
        estado: cotizaciones[0].estado as string,
        items: (cotizaciones[0].items ?? []) as {
          id: string
          solicitud_item_id: string
          proveedor_id: string
          precio_unitario: number
          cantidad: number
          moneda: string
        }[],
      }
    : null

  const obra = Array.isArray(solicitud.obra) ? solicitud.obra[0] : solicitud.obra

  return (
    <main className="page-shell">
      <PageHeader
        title="Cotizar solicitud"
        description={`${(obra as { nombre?: string } | null)?.nombre ?? 'Proyecto'} · Estatus: ${solicitud.estado}`}
        backHref={`/solicitudes/${resolvedparams.id}`}
        backLabel="Volver a la solicitud"
        action={{
          label: 'Gestionar proveedores',
          href: '/proveedores',
        }}
      />

      <CotizarForm
        solicitudId={resolvedparams.id}
        items={
          (solicitud.items ?? []) as unknown as {
            id: string
            cantidad_solicitada: number
            material: {
              nombre_base: string
              variante: string | null
              unidad_medida: string
            } | null
          }[]
        }
        proveedores={(proveedores ?? []) as { id: string; nombre: string }[]}
        cotizacionExistente={cotizacionExistente}
      />
    </main>
  )
}
