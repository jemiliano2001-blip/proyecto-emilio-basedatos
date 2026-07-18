import { createBrowserClient } from '@supabase/ssr'

// Cliente para usarse en componentes de cliente ('use client').
// Usa la llave pública (anon key) — NUNCA la service_role key aquí.
// La seguridad real la da RLS en la base de datos, no esta llave.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
