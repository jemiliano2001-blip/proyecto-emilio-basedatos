import { notFound, redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { AsignarMaterialesObraForm } from '@/components/AsignarMaterialesObraForm'
import { asignarMaterialesMasivosAction } from '@/lib/actions/topes'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarTopes } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { CatalogoMaterial, MaterialKitWithItems } from '@/lib/types'

export default async function AsignarMaterialesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedparams = await params
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarTopes(session.rol)) {
    redirect(`/obras/${resolvedparams.id}`)
  }

  const supabase = await createClient()
  const { data: obra } = await supabase
    .from('obras')
    .select('id, nombre')
    .eq('id', resolvedparams.id)
    .maybeSingle()

  if (!obra) notFound()

  // Materiales activos con precio_base
  const { data: materialesRaw } = await supabase
    .from('catalogo_materiales')
    .select('id, nombre_base, variante, unidad_medida, categoria, subcategoria, especificacion, precio_base, activo, foto_url')
    .eq('activo', true)
    .order('nombre_base')

  const materiales: CatalogoMaterial[] = (materialesRaw ?? []).map((m) => ({
    ...m,
    precio_base: Number(m.precio_base ?? 0),
  }))

  // Kits / Ensambles activos
  const { data: kitsRaw } = await supabase
    .from('material_kits')
    .select(`
      id,
      nombre,
      material_principal_id,
      configuracion,
      descripcion,
      activo,
      creado_en,
      material_kit_items (
        id,
        kit_id,
        material_id,
        cantidad,
        creado_en,
        catalogo_materiales (
          id,
          nombre_base,
          variante,
          unidad_medida,
          precio_base
        )
      )
    `)
    .eq('activo', true)
    .order('nombre')

  interface KitItemDbRow {
    id: string
    kit_id: string
    material_id: string
    cantidad: number
    creado_en: string
    catalogo_materiales?: {
      id: string
      nombre_base: string
      variante: string | null
      unidad_medida: string
      precio_base: number | null
    } | null
  }

  interface KitDbRow {
    id: string
    nombre: string
    material_principal_id: string | null
    configuracion: string | null
    descripcion: string | null
    activo: boolean
    creado_en: string
    material_kit_items?: KitItemDbRow[]
  }

  const kits: MaterialKitWithItems[] = ((kitsRaw as unknown as KitDbRow[]) ?? []).map((k) => ({
    id: k.id,
    nombre: k.nombre,
    material_principal_id: k.material_principal_id,
    configuracion: k.configuracion,
    descripcion: k.descripcion,
    activo: k.activo,
    creado_en: k.creado_en,
    items: (k.material_kit_items ?? []).map((it) => ({
      id: it.id,
      kit_id: it.kit_id,
      material_id: it.material_id,
      cantidad: Number(it.cantidad),
      creado_en: it.creado_en,
      nombre_base: it.catalogo_materiales?.nombre_base ?? 'Material',
      variante: it.catalogo_materiales?.variante ?? null,
      unidad_medida: it.catalogo_materiales?.unidad_medida ?? 'PZA',
      precio_base: Number(it.catalogo_materiales?.precio_base ?? 0),
    })),
  }))

  const action = asignarMaterialesMasivosAction.bind(null, resolvedparams.id)

  return (
    <main className="page-shell space-y-6">
      <PageHeader
        title="Asignar Materiales y Kits"
        description="Incorpora materiales individuales o configuraciones de kits de transformadores."
        backHref={`/obras/${resolvedparams.id}`}
        backLabel={`Volver a ${obra.nombre}`}
      />

      <AsignarMaterialesObraForm
        action={action}
        obraId={resolvedparams.id}
        obraNombre={obra.nombre}
        materiales={materiales}
        kits={kits}
      />
    </main>
  )
}
