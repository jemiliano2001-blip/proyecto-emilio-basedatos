export default function Loading() {
  return <main className="page-shell" aria-busy="true" aria-label="Cargando">
    <p className="sr-only" role="status">Cargando información…</p>
    <div className="h-16 mb-4 rounded-lg bg-rule motion-safe:animate-pulse" />
    {[0, 1, 2, 3].map(i => <div key={i} className="h-24 mb-4 rounded-lg bg-rule motion-safe:animate-pulse" />)}
  </main>
}
