// Route-level loading skeleton — sekin server-render paytida "qotish/oq ekran"
// o'rniga skeleton ko'rsatiladi (barcha (app) route'lariga cascade bo'ladi).
export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="h-7 w-48 rounded-lg bg-surface-2" />
      <div className="card p-5 space-y-3">
        <div className="h-4 w-3/4 rounded bg-surface-2" />
        <div className="h-4 w-1/2 rounded bg-surface-2" />
        <div className="h-4 w-2/3 rounded bg-surface-2" />
      </div>
      <div className="card p-5 space-y-3">
        <div className="h-4 w-2/3 rounded bg-surface-2" />
        <div className="h-4 w-1/3 rounded bg-surface-2" />
      </div>
    </div>
  );
}
