import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const startedAt = Date.now()
  let databaseStatus: 'connected' | 'error' = 'error'
  let latencyMs = 0

  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('obras')
      .select('id', { count: 'exact', head: true })

    latencyMs = Date.now() - startedAt

    if (!error) {
      databaseStatus = 'connected'
    }
  } catch {
    databaseStatus = 'error'
    latencyMs = Date.now() - startedAt
  }

  const isHealthy = databaseStatus === 'connected'

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        status: databaseStatus,
        latencyMs,
      },
    },
    { status: isHealthy ? 200 : 503 }
  )
}
