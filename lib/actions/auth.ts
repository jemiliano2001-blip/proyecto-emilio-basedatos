'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { sanitizeNextPath } from '@/lib/auth/safe-next'
import { checkRateLimit, getClientIp, resetRateLimit } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'

export async function loginAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const next = sanitizeNextPath(String(formData.get('next') ?? '/'))

  if (!email || !password) {
    return { error: 'Escribe tu correo y contraseña.' }
  }

  const reqHeaders = await headers()
  const ip = getClientIp(reqHeaders)
  const rateLimitKey = `login:${ip}:${email}`

  const rateCheck = checkRateLimit(rateLimitKey, {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutos
  })

  if (!rateCheck.allowed) {
    const minutos = Math.ceil(rateCheck.resetMs / 60000)
    return {
      error: `Demasiados intentos fallidos. Por seguridad, espera ${minutos} minuto(s) antes de volver a intentar.`,
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'No se pudo iniciar sesión. Revisa correo y contraseña.' }
  }

  resetRateLimit(rateLimitKey)

  revalidatePath('/', 'layout')
  redirect(next)
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
