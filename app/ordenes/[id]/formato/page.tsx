import { notFound, redirect } from 'next/navigation'
import { OrdenCompraFormatoImpresion } from '@/components/OrdenCompraFormatoImpresion'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeVerPrecios } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function OrdenFormatoPage({ params }: PageProps) {
  const resolvedparams = await params
  const session = await getSessionUsuario()
  if (!session || !puedeVerPrecios(session.rol)) {
    redirect('/')
  }

  const supabase = await createClient()

  const { data: orden, error } = await supabase
    .from('ordenes_compra')
    .select(
      `id, folio, folio_fisico, total, moneda, estado, creado_en,
       obra:obras(nombre, fraccionamiento),
       proveedor:proveedores(nombre, contacto, telefono),
       creador:usuarios!ordenes_compra_creado_por_fkey(nombre),
       solicitud:solicitudes_material(
         solicitante:usuarios!solicitudes_material_solicitante_id_fkey(nombre)
       ),
       items:orden_compra_items(
         id, cantidad, precio_unitario, subtotal, descripcion, tipo_linea,
         material:catalogo_materiales(nombre_base, variante, unidad_medida)
       )`
    )
    .eq('id', resolvedparams.id)
    .maybeSingle()

  if (error || !orden) {
    notFound()
  }

  // Resolver solicitante
  type SolicitudConSolicitante = {
    solicitante: { nombre: string } | null
  } | null

  const sol = orden.solicitud as unknown as SolicitudConSolicitante
  const creadorObj = orden.creador as unknown as { nombre: string } | null
  const solicitanteNombre = sol?.solicitante?.nombre || creadorObj?.nombre || 'Manuel Gtz'

  // Resolver autorizador: Si fue emitida desde requisición aprobada por Thalía o creada por sesión
  const autorizadoPor = 'Thalía'

  type ItemData = {
    id: string
    cantidad: number
    descripcion: string | null
    tipo_linea: string
    material: {
      nombre_base: string
      variante: string | null
      unidad_medida: string
    } | null
  }

  const itemsMapeados = ((orden.items ?? []) as unknown as ItemData[]).map((it) => ({
    id: it.id,
    cantidad: Number(it.cantidad),
    unidad_medida: it.material?.unidad_medida || 'PZA',
    nombre_material: it.material?.nombre_base || it.descripcion || 'Material',
    variante: it.material?.variante,
    descripcion: it.descripcion,
    tipo_linea: it.tipo_linea,
  }))

  const obraObj = orden.obra as unknown as { nombre: string; fraccionamiento: string | null } | null
  const proveedorObj = orden.proveedor as unknown as { nombre: string } | null

  const formatoData = {
    id: orden.id,
    folio: orden.folio,
    folio_fisico: orden.folio_fisico,
    creado_en: orden.creado_en,
    moneda: orden.moneda,
    total: Number(orden.total),
    solicitante_nombre: solicitanteNombre,
    proveedor_nombre: proveedorObj?.nombre || '',
    obra_nombre: obraObj?.nombre || 'Obra',
    obra_fraccionamiento: obraObj?.fraccionamiento,
    autorizado_por: autorizadoPor,
    items: itemsMapeados,
  }

  return <OrdenCompraFormatoImpresion orden={formatoData} />
}
