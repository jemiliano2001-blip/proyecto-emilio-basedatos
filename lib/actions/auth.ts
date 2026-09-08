'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { sanitizeNextPath } from '@/lib/auth/safe-next'
import { createClient } from '@/lib/supabase/server'

export async function loginAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const next = sanitizeNextPath(String(formData.get('next') ?? '/'))

  if (!email || !password) {
    return { error: 'Escribe tu correo y contraseña.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'No se pudo iniciar sesión. Revisa correo y contraseña.' }
  }

  revalidatePath('/', 'layout')
  redirect(next)
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
