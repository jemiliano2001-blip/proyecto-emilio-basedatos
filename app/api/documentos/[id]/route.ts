import { NextResponse } from 'next/server'
import { getSessionUsuario } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getSessionUsuario()) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  const { id } = await params
  const supabase = await createClient()
  // La policy comprueba rol, proyecto y tipo de documento antes de firmar.
  const { data: documento, error } = await supabase.from('obra_documentos').select('archivo_path').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: 'No se pudo consultar el documento.' }, { status: 503 })
  if (!documento) return NextResponse.json({ error: 'Documento no disponible.' }, { status: 404 })
  const { data, error: storageError } = await supabase.storage.from('obra-documentos').createSignedUrl(documento.archivo_path, 60)
  if (storageError || !data) return NextResponse.json({ error: 'No se pudo abrir el documento.' }, { status: 503 })
  const response = NextResponse.redirect(data.signedUrl)
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}
