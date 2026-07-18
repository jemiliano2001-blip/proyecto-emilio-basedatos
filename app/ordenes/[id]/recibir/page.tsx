import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { RecepcionForm } from '@/components/RecepcionForm'
import { crearRecepcionAction } from '@/lib/actions/recepciones'
import { getSessionUsuario } from '@/lib/auth/session'
import { puedeCapturarRecepcion } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { OrdenItemChecklist } from '@/lib/types'

export default async function RecibirOrdenPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getSessionUsuario()
  if (!session || !puedeCapturarRecepcion(session.rol)) {
    redirect('/')
  }

  const supabase = createClient()
  const { data, error } = await supabase.rpc('detalle_orden_checklist', {
    p_orden_id: params.id,
  })

  if (error) {
    notFound()
  }

  const items = (data ?? []) as OrdenItemChecklist[]
  if (items.length === 0) {
    notFound()
  }

  const cabecera = items[0]

  return (
    <main className="max-w-2xl mx-auto p-4 pb-28">
      <header className="mb-6 pt-4">
        <Link href="/recepciones" className="text-sm text-[#1E7F7A] font-medium">
          ← Recepción
        </Link>
        <h1 className="text-2xl font-bold text-[#132A45] mt-2">
          Checklist · {cabecera.folio}
        </h1>
        <p className="text-gray-500 text-sm">{cabecera.obra_nombre}</p>
        <p className="text-xs text-gray-400">{cabecera.proveedor_nombre}</p>
        <p className="text-xs text-gray-400 mt-1 capitalize">
          Estado OC: {String(cabecera.orden_estado).replaceAll('_', ' ')}
        </p>
      </header>

      <RecepcionForm action={crearRecepcionAction} ordenId={params.id} items={items} />
    </main>
  )
}
