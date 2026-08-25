import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ObraForm } from '@/components/ObraForm'
import { createObraAction } from '@/lib/actions/obras'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarObras } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { CatalogoMaterial, MaterialKitWithItems } from '@/lib/types'

export default async function NuevaObraPage() {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarObras(session.rol)) {
    redirect('/')
  }

  const supabase = createClient()

  // Materiales con precio_base
  const { data: materialesRaw } = await supabase
    .from('catalogo_materiales')
    .select('id, nombre_base, variante, unidad_medida, categoria, subcategoria, especificacion, precio_base, activo, foto_url')
    .eq('activo', true)
    .order('nombre_base')

  const materiales: CatalogoMaterial[] = (materialesRaw ?? []).map((m) => ({
    ...m,
    precio_base: Number(m.precio_base ?? 0),
  }))

  // Kits / Ensambles con items asociados
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
    material_kit_items?: KitItemDbRow[] | null
  }

  // Mapear los kits
  const rawList = (kitsRaw ?? []) as unknown as KitDbRow[]
  const kits: MaterialKitWithItems[] = rawList.map((k) => ({
    id: k.id,
    nombre: k.nombre,
    material_principal_id: k.material_principal_id,
    configuracion: k.configuracion,
    descripcion: k.descripcion,
    activo: k.activo,
    creado_en: k.creado_en,
    items: (k.material_kit_items ?? []).map((ki) => ({
      id: ki.id,
      kit_id: ki.kit_id,
      material_id: ki.material_id,
      cantidad: Number(ki.cantidad ?? 0),
      creado_en: ki.creado_en,
      nombre_base: ki.catalogo_materiales?.nombre_base,
      variante: ki.catalogo_materiales?.variante,
      unidad_medida: ki.catalogo_materiales?.unidad_medida,
      precio_base: Number(ki.catalogo_materiales?.precio_base ?? 0),
    })),
  }))

  return (
    <main className="page-shell">
      <header className="mb-6 pt-4">
        <Link href="/" className="text-sm text-accent font-medium hover:underline">
          ← Volver a proyectos
        </Link>
        <h1 className="text-2xl font-bold text-ink mt-2">Nuevo proyecto</h1>
        <p className="text-sm text-gray-500 mt-1">
          Registra la información general y define el presupuesto de materiales asignados para el proyecto.
        </p>
      </header>

      <ObraForm
        action={createObraAction}
        submitLabel="Crear proyecto"
        materiales={materiales}
        kits={kits}
        allowTopesOnCreate
      />
    </main>
  )
}
