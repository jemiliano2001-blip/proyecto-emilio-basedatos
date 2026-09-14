export default function Loading() {
  return <main className="page-shell" aria-busy="true" aria-label="Cargando">
    <p className="sr-only" role="status">Cargando información…</p>
    <div className="mb-6 flex min-h-[68px] items-center justify-between gap-4">
      <div className="space-y-2"><div className="h-6 w-44 rounded bg-rule motion-safe:animate-pulse" /><div className="h-4 w-64 max-w-[70vw] rounded bg-rule motion-safe:animate-pulse" /></div>
      <div className="h-11 w-32 rounded-lg bg-rule motion-safe:animate-pulse" />
    </div>
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">{[0, 1, 2].map(i => <div key={i} className="h-[72px] rounded-xl bg-rule motion-safe:animate-pulse" />)}</div>
    <div className="mb-6 grid grid-cols-3 gap-3">{[0, 1, 2].map(i => <div key={i} className="h-[82px] rounded-xl bg-rule motion-safe:animate-pulse" />)}</div>
    <div className="h-11 mb-4 rounded-lg bg-rule motion-safe:animate-pulse" />
    {[0, 1, 2, 3].map(i => <div key={i} className="h-[80px] mb-3 rounded-xl bg-rule motion-safe:animate-pulse" />)}
  </main>
}
