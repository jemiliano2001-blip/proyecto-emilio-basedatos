import { LoginForm } from '@/components/LoginForm'
import { IconLogo } from '@/components/icons'
import { sanitizeNextPath } from '@/lib/auth/safe-next'

const PILARES = [
  { n: '01', titulo: 'Requisiciones con trazabilidad', texto: 'De la solicitud en campo a la orden de compra, cada paso queda registrado.' },
  { n: '02', titulo: 'Presupuesto dual', texto: 'Cantidad y dinero por proyecto: usado, comprometido y disponible.' },
  { n: '03', titulo: 'Recepción y cierre', texto: 'Materiales recibidos, asignados e instalados, conciliados al cerrar.' },
]

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const resolvedsearchParams = await searchParams
  const next = sanitizeNextPath(resolvedsearchParams.next)

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Panel de marca (solo desktop) */}
      <aside className="relative isolate hidden overflow-hidden bg-foreground text-background lg:flex lg:flex-col lg:justify-between lg:p-14">
        <div aria-hidden className="bg-blueprint pointer-events-none absolute inset-0 -z-10 opacity-20" />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 -z-10 size-[28rem] rounded-full bg-primary/40 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-24 -z-10 size-[24rem] rounded-full bg-secondary/30 blur-3xl"
        />

        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-primary">
            <IconLogo className="size-5" />
          </span>
          <span className="font-heading text-xl font-bold tracking-tight">ObraTrack</span>
        </div>

        <div className="max-w-md">
          <h2 className="font-heading text-4xl font-bold leading-[1.1] tracking-tight">
            Cada material, cada peso y cada proyecto, bajo control.
          </h2>
          <ol className="mt-10 space-y-6">
            {PILARES.map((pilar) => (
              <li key={pilar.n} className="flex gap-4">
                <span className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-primary-soft/80">
                  {pilar.n}
                </span>
                <div>
                  <p className="text-sm font-semibold text-background">{pilar.titulo}</p>
                  <p className="mt-1 text-sm leading-relaxed text-background/60">{pilar.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <p className="text-xs text-background/50">Uso interno · {new Date().getFullYear()}</p>
      </aside>

      {/* Formulario */}
      <section className="flex flex-col justify-center px-4 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-sm animate-enter">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-primary">
              <IconLogo className="size-5" />
            </span>
            <span className="font-heading text-xl font-bold tracking-tight text-foreground">ObraTrack</span>
          </div>

          <header className="mb-8">
            <p className="t-eyebrow mb-3">Acceso</p>
            <h1 className="t-display">Iniciar sesión</h1>
            <p className="mt-2 text-sm text-muted-foreground">Usa tu cuenta individual.</p>
          </header>

          <div className="card">
            <LoginForm next={next} />
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            ¿Sin acceso? Pide tu cuenta al administrador.
          </p>
        </div>
      </section>
    </main>
  )
}
