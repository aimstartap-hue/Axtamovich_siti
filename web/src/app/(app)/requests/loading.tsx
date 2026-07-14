import BoardSkeleton from "./BoardSkeleton";

// Zayavkalar sahifasi skeleton loader (route-level).
export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between animate-pulse">
        <div className="h-7 w-40 rounded-lg" style={{ background: "var(--surface-2)" }} />
        <div className="h-9 w-36 rounded-xl" style={{ background: "var(--surface-2)" }} />
      </div>
      <div className="rounded-2xl p-3 h-14 animate-pulse" style={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
      <BoardSkeleton />
    </div>
  );
}
