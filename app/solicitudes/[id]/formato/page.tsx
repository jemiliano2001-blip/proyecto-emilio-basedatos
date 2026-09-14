import { notFound, redirect } from 'next/navigation'
import { OrdenCompraFormatoImpresion } from '@/components/OrdenCompraFormatoImpresion'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeAprobarCompras, puedeVerPrecios } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'

interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * Plantilla tipo OC para Compras al atender una solicitud (antes de que exista OC).
 * Folio = BORRADOR; proveedor = A DETERMINAR.
 */
export default async function SolicitudFormatoPage({ params }: PageProps) {
  const resolved = await params
  const session = await getSessionUsuario()
  if (
    !session ||
    (!puedeAprobarCompras(session.rol) && !puedeVerPrecios(session.rol))
  ) {
    redirect('/solicitudes')
  }

  const supabase = await createClient()
  const { data: solicitud, error } = await supabase
    .from('solicitudes_material')
    .select(
      `id, creado_en, estado,
       obra:obras(nombre, fraccionamiento),
       solicitante:usuarios(nombre),
       items:solicitud_items(
         id, tipo_linea, cantidad_solicitada, descripcion, monto_mxn,
         material:catalogo_materiales(nombre_base, variante, unidad_medida)
       )`
    )
    .eq('id', resolved.id)
    .maybeSingle()

  if (error || !solicitud) notFound()

  type ItemRow = {
    id: string
    tipo_linea: string | null
    cantidad_solicitada: number | null
    descripcion: string | null
    material: {
      nombre_base: string
      variante: string | null
      unidad_medida: string
    } | null
  }

  const itemsRaw = (solicitud.items ?? []) as unknown as ItemRow[]
  const itemsMapeados = itemsRaw.map((it) => ({
    id: it.id,
    cantidad: Number(it.cantidad_solicitada ?? 1),
    unidad_medida: it.material?.unidad_medida || 'PZA',
    nombre_material: it.material?.nombre_base || it.descripcion || 'Partida',
    variante: it.material?.variante,
    descripcion: it.descripcion,
    tipo_linea: it.tipo_linea ?? 'material',
  }))

  const obra = solicitud.obra as unknown as {
    nombre: string
    fraccionamiento: string | null
  } | null
  const solicitante = solicitud.solicitante as unknown as { nombre: string } | null

  const formatoData = {
    id: solicitud.id,
    folio: 'BORRADOR',
    folio_fisico: null as string | null,
    creado_en: solicitud.creado_en as string,
    moneda: 'MXN',
    total: 0,
    solicitante_nombre: solicitante?.nombre || '—',
    proveedor_nombre: 'A DETERMINAR',
    obra_nombre: obra?.nombre || 'Proyecto',
    obra_fraccionamiento: obra?.fraccionamiento,
    autorizado_por: session.perfil?.nombre || 'Compras',
    items: itemsMapeados,
  }

  return (
    <OrdenCompraFormatoImpresion
      orden={formatoData}
      volverHref={`/solicitudes/${solicitud.id}`}
      volverLabel="Volver a la solicitud"
    />
  )
}
