'use client'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="es">
      <body className="bg-muted/50 text-foreground font-sans min-h-screen flex items-center justify-center p-4">
        <main className="max-w-md w-full p-6 bg-card rounded-xl shadow-lg border border-danger/30 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-danger-soft flex items-center justify-center text-danger font-bold text-xl">
            !
          </div>
          <h1 className="text-lg font-bold text-foreground mb-2">
            Error del sistema
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Ocurrió un error crítico al inicializar la aplicación. Si el problema persiste, verifica tu conexión o contacta a soporte.
          </p>
          <button
            type="button"
            className="w-full py-2.5 px-4 bg-primary hover:bg-primary-hover text-primary-foreground font-medium rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
            onClick={() => reset()}
          >
            Reintentar
          </button>
        </main>
      </body>
    </html>
  )
}
