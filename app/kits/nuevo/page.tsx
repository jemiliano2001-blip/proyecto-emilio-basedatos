import Link from 'next/link'
import { redirect } from 'next/navigation'
import { KitForm } from '@/components/KitForm'
import { createKitAction } from '@/lib/actions/kits'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarKits } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { CatalogoMaterial } from '@/lib/types'

export default async function NuevoKitPage() {
  const session = await getSessionUsuario()
  if (!session || !puedeGestionarKits(session.rol)) {
    redirect('/kits')
  }

  const supabase = createClient()
  const { data: materialesRaw } = await supabase
    .from('catalogo_materiales')
    .select('id, nombre_base, variante, unidad_medida, categoria, subcategoria, precio_base, activo')
    .eq('activo', true)
    .order('nombre_base')

  const materiales = (materialesRaw as CatalogoMaterial[] | null) ?? []

  return (
    <main className="page-shell space-y-6">
      <header className="mb-4 pt-2">
        <Link href="/kits" className="text-sm font-medium text-accent hover:underline">
          ← Volver a Kits
        </Link>
        <h1 className="text-2xl font-bold text-ink mt-2">Nueva Plantilla de Kit</h1>
        <p className="text-sm text-gray-500">
          Define un equipo principal con su configuración y el conjunto de accesorios menores asociados.
        </p>
      </header>

      <KitForm action={createKitAction} materiales={materiales} submitLabel="Guardar Kit / Ensamble" />
    </main>
  )
}
