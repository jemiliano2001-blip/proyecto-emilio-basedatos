import { createHash } from 'node:crypto'
import { logger } from '@/lib/logger'
import type { createClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createClient>>

const MAX_POR_IP_Y_CORREO = 5
const MAX_POR_IP = 20

const hash = (clave: string) => createHash('sha256').update(clave).digest('hex')

function claves(ip: string, email: string) {
  return [
    { clave: hash(`login:${ip}:${email}`), max: MAX_POR_IP_Y_CORREO },
    { clave: hash(`login:${ip}`), max: MAX_POR_IP },
  ]
}

/** Segundos de bloqueo restantes (0 = libre). Si la BD falla, no bloquea: queda el límite en memoria. */
export async function segundosBloqueoLogin(supabase: Supabase, ip: string, email: string): Promise<number> {
  let maximo = 0
  for (const { clave, max } of claves(ip, email)) {
    const { data, error } = await supabase.rpc('login_segundos_bloqueo', { p_clave: clave, p_max: max })
    if (error) {
      logger.warn('login_rate_limit_no_disponible', { mensaje: error.message })
      return 0
    }
    maximo = Math.max(maximo, Number(data) || 0)
  }
  return maximo
}

export async function registrarFalloLogin(supabase: Supabase, ip: string, email: string): Promise<void> {
  for (const { clave } of claves(ip, email)) {
    const { error } = await supabase.rpc('login_registrar_fallo', { p_clave: clave })
    if (error) logger.warn('login_rate_limit_no_disponible', { mensaje: error.message })
  }
}

export async function limpiarLogin(supabase: Supabase, ip: string, email: string): Promise<void> {
  const { error } = await supabase.rpc('login_limpiar', { p_clave: claves(ip, email)[0].clave })
  if (error) logger.warn('login_rate_limit_no_disponible', { mensaje: error.message })
}
