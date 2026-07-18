import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { CotizarForm } from '@/components/CotizarForm'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeCotizar } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'

export default async function CotizarSolicitudPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getSessionUsuario()
  if (!session || !puedeCotizar(session.rol)) {
    redirect(`/solicitudes/${params.id}`)
  }

  const supabase = createClient()

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
    .eq('id', params.id)
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
    .eq('solicitud_id', params.id)
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
    <main className="max-w-2xl mx-auto p-4 pb-28">
      <header className="mb-6 pt-4">
        <Link
          href={`/solicitudes/${params.id}`}
          className="text-sm text-[#1E7F7A] font-medium"
        >
          ← Volver a la solicitud
        </Link>
        <h1 className="text-2xl font-bold text-[#132A45] mt-2">Cotizar solicitud</h1>
        <p className="text-gray-500 text-sm">
          {(obra as { nombre?: string } | null)?.nombre ?? 'Obra'} · estado{' '}
          <span className="capitalize">{solicitud.estado}</span>
        </p>
        <Link href="/proveedores" className="text-sm font-semibold text-[#1E7F7A] inline-block mt-2">
          Gestionar proveedores
        </Link>
      </header>

      <CotizarForm
        solicitudId={params.id}
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
