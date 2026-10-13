import { NextResponse } from 'next/server'
import { getSessionUsuario } from '@/lib/auth/session'
import { esIdFacturaOrden, FACTURA_SIGNED_URL_SECONDS } from '@/lib/facturas-oc'
import { puedeVerPrecios } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUsuario()
  if (!session) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  // Mismo corte que la pantalla de la OC. La frontera real es RLS de
  // orden_compra_facturas y la policy de storage (path registrado + puede_acceder_obra).
  if (!puedeVerPrecios(session.rol)) {
    return NextResponse.json({ error: 'No tienes permiso para ver esta factura.' }, { status: 403 })
  }

  const { id } = await params
  if (!esIdFacturaOrden(id)) {
    return NextResponse.json({ error: 'Factura no disponible.' }, { status: 404 })
  }

  const supabase = await createClient()
  const { data: factura, error } = await supabase
    .from('orden_compra_facturas')
    .select('archivo_path')
    .eq('id', id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'No se pudo consultar la factura.' }, { status: 503 })
  if (!factura?.archivo_path) {
    return NextResponse.json({ error: 'Factura no disponible.' }, { status: 404 })
  }

  const { data, error: storageError } = await supabase.storage
    .from('obra-documentos')
    .createSignedUrl(factura.archivo_path, FACTURA_SIGNED_URL_SECONDS)
  if (storageError || !data?.signedUrl) {
    return NextResponse.json({ error: 'No se pudo abrir la factura.' }, { status: 503 })
  }

  const response = NextResponse.redirect(data.signedUrl)
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}
