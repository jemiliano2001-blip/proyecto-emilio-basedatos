'use client'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="es">
      <body className="bg-slate-50 text-slate-900 font-sans min-h-screen flex items-center justify-center p-4">
        <main className="max-w-md w-full p-6 bg-white rounded-xl shadow-lg border border-red-200 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-xl">
            !
          </div>
          <h1 className="text-lg font-bold text-slate-900 mb-2">
            Error del sistema
          </h1>
          <p className="text-sm text-slate-600 mb-6">
            Ocurrió un error crítico al inicializar la aplicación. Si el problema persiste, verifica tu conexión o contacta a soporte.
          </p>
          <button
            type="button"
            className="w-full py-2.5 px-4 bg-[#132A45] hover:bg-[#1E7F7A] text-white font-medium rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#1E7F7A]"
            onClick={() => reset()}
          >
            Reintentar
          </button>
        </main>
      </body>
    </html>
  )
}
