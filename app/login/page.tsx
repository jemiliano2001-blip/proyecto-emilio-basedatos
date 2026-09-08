import { LoginForm } from '@/components/LoginForm'
import { sanitizeNextPath } from '@/lib/auth/safe-next'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const resolvedsearchParams = await searchParams
  const next = sanitizeNextPath(resolvedsearchParams.next)

  return (
    <main className="max-w-md mx-auto p-4 min-h-screen flex flex-col justify-center">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-ink">Proyecto Emilio</h1>
        <p className="text-gray-500 text-sm mt-1">
          Inicia sesión con tu cuenta individual
        </p>
      </header>
      <LoginForm next={next} />
    </main>
  )
}
