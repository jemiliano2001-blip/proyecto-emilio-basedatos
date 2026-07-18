'use client'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="max-w-2xl mx-auto p-4 pt-12">
      <div className="card border-red-300 bg-red-50">
        <h1 className="text-lg font-semibold text-red-800 mb-2">
          Algo salió mal
        </h1>
        <p className="text-red-700 text-sm mb-4">
          No pudimos cargar esta pantalla. Revisa tu conexión e intenta de nuevo.
        </p>
        <button type="button" className="btn-primary" onClick={() => reset()}>
          Reintentar
        </button>
      </div>
    </main>
  )
}
