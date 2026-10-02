/** Shown while a tab's data loads, so the screen is never blank. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="animate-pulse space-y-3">
      <div className="mb-5 h-8 w-40 rounded-lg bg-panel" />
      <div className="h-11 rounded-lg bg-panel" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-24 rounded-xl border border-line bg-panel" />
      ))}
    </div>
  );
}
