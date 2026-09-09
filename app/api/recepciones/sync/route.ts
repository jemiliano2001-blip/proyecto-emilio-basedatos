import { NextResponse } from 'next/server'
import { syncRecepcionPayload } from '@/lib/actions/recepciones'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const ip = getClientIp(request.headers)
  const rate = checkRateLimit(`sync:recepciones:${ip}`, {
    maxRequests: 30,
    windowMs: 60 * 1000,
  })

  if (!rate.allowed) {
    return NextResponse.json(
      { status: 'reintentar', error: 'Demasiadas solicitudes de sincronización. Espera un momento.' },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { status: 'conflicto', error: 'JSON inválido.' },
      { status: 400 }
    )
  }

  const result = await syncRecepcionPayload(body)

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
