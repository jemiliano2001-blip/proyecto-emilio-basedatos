import { LoginForm } from '@/components/LoginForm'
import { IconCheckCircle, IconLogo } from '@/components/icons'
import { sanitizeNextPath } from '@/lib/auth/safe-next'

const PUNTOS = [
  'Requisiciones con saldo en tiempo real por proyecto',
  'Aprobación en dos pasos: Compras reserva, Finanzas paga',
  'Recepción en obra que funciona sin señal y sincroniza después',
]

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const resolvedsearchParams = await searchParams
  const next = sanitizeNextPath(resolvedsearchParams.next)

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Panel de marca (solo desktop) */}
      <aside className="relative hidden overflow-hidden bg-foreground text-background lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 size-[28rem] rounded-full bg-primary/30 blur-3xl"
        />
        <div className="relative flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
            <IconLogo className="size-6" />
          </span>
          <span className="text-lg font-semibold tracking-tight">ObraTrack</span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Control de materiales y presupuesto, de la requisición a la obra.
          </h2>
          <ul className="mt-8 space-y-4">
            {PUNTOS.map((punto) => (
              <li key={punto} className="flex items-start gap-3 text-sm text-background/80">
                <IconCheckCircle className="mt-0.5 size-5 shrink-0 text-primary" />
                <span>{punto}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-background/50">
          © {new Date().getFullYear()} ObraTrack · Uso interno
        </p>
      </aside>

      {/* Formulario */}
      <section className="flex flex-col justify-center px-4 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <IconLogo className="size-6" />
            </span>
            <span className="text-lg font-semibold tracking-tight text-foreground">ObraTrack</span>
          </div>

          <header className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Iniciar sesión</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Entra con tu cuenta individual. Tu rol define qué puedes ver y aprobar.
            </p>
          </header>

          <LoginForm next={next} />

          <p className="mt-8 text-center text-xs text-muted-foreground">
            ¿Sin acceso? Pide tu cuenta al administrador del sistema.
          </p>
        </div>
      </section>
    </main>
  )
}
