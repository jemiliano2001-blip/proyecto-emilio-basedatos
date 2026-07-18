import { NextResponse } from 'next/server'
import { syncSolicitudPayload } from '@/lib/actions/solicitudes'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { status: 'conflicto', error: 'JSON inválido.' },
      { status: 400 }
    )
  }

  const result = await syncSolicitudPayload(body)

  if (result.status === 'sincronizado') {
    return NextResponse.json(result, { status: 200 })
  }
  if (result.status === 'no_autenticado') {
    return NextResponse.json(result, { status: 401 })
  }
  if (result.status === 'conflicto') {
    return NextResponse.json(result, { status: 409 })
  }
  return NextResponse.json(result, { status: 503 })
}
