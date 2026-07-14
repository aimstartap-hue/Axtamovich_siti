// KPI + jadval skeleton — filter o'zgarganda (Suspense fallback) va sahifa yuklanishida.
export default function BoardSkeleton() {
  const box = { background: "var(--surface)", border: "1px solid var(--border)" } as const;
  const bar = { background: "var(--surface-2)" } as const;
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl p-4 h-[104px]" style={box}>
            <div className="w-8 h-8 rounded-lg" style={bar} />
            <div className="mt-3 h-5 w-20 rounded" style={bar} />
            <div className="mt-2 h-3 w-16 rounded" style={bar} />
          </div>
        ))}
      </div>
      <div className="rounded-2xl overflow-hidden" style={box}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="h-4 w-10 rounded" style={bar} />
            <div className="h-4 flex-1 max-w-[220px] rounded" style={bar} />
            <div className="h-4 w-24 rounded hidden sm:block" style={bar} />
            <div className="h-4 w-20 rounded ml-auto" style={bar} />
            <div className="h-5 w-24 rounded-full" style={bar} />
            <div className="h-4 w-16 rounded" style={bar} />
          </div>
        ))}
      </div>
    </div>
  );
}
