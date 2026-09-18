import { LoginForm } from '@/components/LoginForm'
import { IconLogo } from '@/components/icons'
import { sanitizeNextPath } from '@/lib/auth/safe-next'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const resolvedsearchParams = await searchParams
  const next = sanitizeNextPath(resolvedsearchParams.next)

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1fr_1fr]">
      {/* Panel de marca (solo desktop) */}
      <aside className="hidden bg-foreground text-background lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <IconLogo className="size-5" />
          </span>
          <span className="text-base font-semibold tracking-tight">ObraTrack</span>
        </div>

        <p className="max-w-sm text-2xl font-medium leading-snug tracking-tight text-background/90">
          Materiales, requisiciones y presupuesto de cada proyecto en un solo lugar.
        </p>

        <p className="text-xs text-background/50">Uso interno · {new Date().getFullYear()}</p>
      </aside>

      {/* Formulario */}
      <section className="flex flex-col justify-center px-4 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <IconLogo className="size-5" />
            </span>
            <span className="text-base font-semibold tracking-tight text-foreground">ObraTrack</span>
          </div>

          <header className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Iniciar sesión</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Usa tu cuenta individual.</p>
          </header>

          <LoginForm next={next} />

          <p className="mt-8 text-center text-xs text-muted-foreground">
            ¿Sin acceso? Pide tu cuenta al administrador.
          </p>
        </div>
      </section>
    </main>
  )
}
