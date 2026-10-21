'use client'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="max-w-2xl mx-auto p-4 pt-12">
      <div className="card border-danger/40 bg-danger-soft">
        <h1 className="text-lg font-semibold text-danger-soft-foreground mb-2">
          No se pudo cargar esta pantalla
        </h1>
        <p className="text-danger-soft-foreground text-sm mb-4">
          Revisa tu conexión y vuelve a intentar. Si sigue igual, avisa a Emilio.
        </p>
        <button type="button" className="btn-primary" onClick={() => reset()}>
          Reintentar
        </button>
      </div>
    </main>
  )
}
