import { NextResponse } from 'next/server'
import { syncInstalacionPayload } from '@/lib/actions/inventario'

export async function POST(request: Request) {
  let raw: unknown
  try { raw = await request.json() } catch { return NextResponse.json({status:'conflicto',error:'Reporte no válido.'}, {status:400}) }
  try {
    const result = await syncInstalacionPayload(raw)
    return NextResponse.json(result, {status: result.status === 'sincronizado' ? 200 : result.status === 'no_autenticado' ? 401 : result.status === 'conflicto' ? 409 : 503})
  } catch { return NextResponse.json({status:'reintentar',error:'No se pudo conectar con el servidor.'}, {status:503}) }
}
