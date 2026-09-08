import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Cliente para usarse en Server Components, Server Actions y Route Handlers.
// Sigue usando la anon key — la sesión del usuario autenticado es la que
// determina qué puede ver/hacer, vía RLS. La service_role key (si algún día
// se necesita para una Edge Function) NUNCA debe importarse desde aquí.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Se puede ignorar si se llama desde un Server Component;
            // el middleware ya refresca la sesión.
          }
        },
      },
    }
  )
}
