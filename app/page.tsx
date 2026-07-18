import Link from 'next/link'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeGestionarObras } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { Obra } from '@/lib/types'

export default async function HomePage() {
  const session = await getSessionUsuario()
  const supabase = createClient()
  const puedeCrear = puedeGestionarObras(session?.rol ?? null)

  const { data: obras, error } = await supabase
    .from('obras')
    .select('id, nombre, fraccionamiento, estado')
    .eq('estado', 'activa')
    .order('nombre')

  return (
    <main className="max-w-2xl mx-auto p-4 pb-28">
      <header className="mb-6 pt-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#132A45]">Obras activas</h1>
          <p className="text-gray-500 text-sm">
            {session?.perfil?.nombre
              ? `Hola, ${session.perfil.nombre}`
              : 'Proyecto Emilio - Materiales y Obras'}
          </p>
        </div>
        {puedeCrear && (
          <Link href="/obras/nueva" className="btn-primary shrink-0 text-sm py-2 px-4">
            Nueva obra
          </Link>
        )}
      </header>

      {error && (
        <div className="card border-red-300 bg-red-50 text-red-700 mb-4">
          No se pudieron cargar las obras. Revisa tu conexión.
        </div>
      )}

      <div className="space-y-3">
        {(obras as Pick<Obra, 'id' | 'nombre' | 'fraccionamiento' | 'estado'>[] | null)?.map(
          (obra) => (
            <Link
              key={obra.id}
              href={`/obras/${obra.id}`}
              className="card flex items-center justify-between block"
            >
              <div>
                <p className="font-semibold">{obra.nombre}</p>
                {obra.fraccionamiento && (
                  <p className="text-sm text-gray-500">{obra.fraccionamiento}</p>
                )}
              </div>
              <span className="text-[#1E7F7A]">→</span>
            </Link>
          )
        )}

        {obras?.length === 0 && (
          <p className="text-gray-500 text-center py-8">
            No hay obras activas todavía.
          </p>
        )}
      </div>
    </main>
  )
}
