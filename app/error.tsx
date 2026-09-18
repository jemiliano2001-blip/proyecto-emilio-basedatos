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
          Algo salió mal
        </h1>
        <p className="text-danger-soft-foreground text-sm mb-4">
          No pudimos cargar esta pantalla. Revisa tu conexión e intenta de nuevo.
        </p>
        <button type="button" className="btn-primary" onClick={() => reset()}>
          Reintentar
        </button>
      </div>
    </main>
  )
}
