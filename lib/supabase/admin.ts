import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase con service_role — SOLO servidor.
 * Nunca importar desde `app/` Client Components ni desde `components/`.
 * Usar únicamente desde server actions / módulos `lib/` que corren en Node.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno del servidor.'
    )
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
