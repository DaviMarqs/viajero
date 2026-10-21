export function PlanningSkeleton({ steps }: { steps: number }) {
  return <div className="planning-page" role="status" aria-busy="true">
    <span className="sr-only">Carregando suas preferências…</span>
    <div className="planning-context" aria-hidden="true"><div className="skeleton-block h-6 w-48" /></div>
    <div className="planning-layout" aria-hidden="true">
      <aside className="planning-sidebar space-y-4"><div className="skeleton-block h-4 w-24" />{Array.from({ length: steps }, (_, index) => <div key={index} className="flex items-center gap-3"><div className="skeleton-block size-6" /><div className="space-y-2"><div className="skeleton-block h-4 w-32" /><div className="skeleton-block h-3 w-24" /></div></div>)}</aside>
      <section className="planning-content"><div className="planning-scroll"><div className="planning-heading"><div className="skeleton-block h-3 w-40" /><div className="skeleton-block h-10 w-3/4" /><div className="skeleton-block h-4 w-full" /></div><div className="planning-controls planning-step-card"><div className="skeleton-block h-16" /><div className="skeleton-block h-24" /><div className="skeleton-block h-24" /></div></div><footer className="planning-footer"><div className="skeleton-block h-11 w-24" /><div className="skeleton-block h-11 w-32" /></footer></section>
    </div>
  </div>;
}
