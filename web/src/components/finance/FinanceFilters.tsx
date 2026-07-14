"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { PERIOD_OPTIONS } from "@/lib/finance";

// Dashboard bo'ylab YAGONA filter paneli: davr (preset yoki Custom range) + xarajat
// turi. Butun statistika shu ikkitasidan qayta hisoblanadi (URL searchParams orqali).
// Chartlarda boshqa filter yo'q.
export default function FinanceFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const from = sp.get("from") || "";
  const to = sp.get("to") || "";
  const isCustom = !!(from || to) || sp.get("period") === "custom";
  const period = isCustom ? "custom" : (sp.get("period") || "30d");
  const type = sp.get("type") || "all";

  function setParams(next: Record<string, string | null>) {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") p.delete(k); else p.set(k, v);
    }
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  }

  const options = [...PERIOD_OPTIONS, { value: "custom" as const, label: "Custom" }];

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl p-3"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {/* Davr */}
      <div className="inline-flex flex-wrap rounded-xl p-1 gap-0.5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        {options.map((o) => {
          const active = period === o.value;
          return (
            <button key={o.value}
              onClick={() => o.value === "custom" ? setParams({ period: "custom" }) : setParams({ period: o.value, from: null, to: null })}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition"
              style={active ? { background: "var(--brand)", color: "var(--brand-fg)" } : { color: "var(--muted)" }}>
              {o.label}
            </button>
          );
        })}
      </div>

      {/* Custom Date Range — faqat Custom tanlansa */}
      {isCustom && (
        <label className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--muted)" }}>
          <input type="date" value={from} max={to || undefined} onChange={(e) => setParams({ period: "custom", from: e.target.value })}
            className="bg-transparent outline-none" style={{ color: "var(--text)" }} />
          <span>—</span>
          <input type="date" value={to} min={from || undefined} onChange={(e) => setParams({ period: "custom", to: e.target.value })}
            className="bg-transparent outline-none" style={{ color: "var(--text)" }} />
        </label>
      )}

      <div className="flex-1" />

      {/* Xarajat turi */}
      <select value={type} onChange={(e) => setParams({ type: e.target.value })}
        className="text-sm px-3 py-1.5 rounded-xl outline-none cursor-pointer"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}>
        <option value="all">Barcha xarajatlar</option>
        <option value="maintenance">Oddiy xarajatlar</option>
        <option value="new_branch">Ochilish xarajatlari</option>
      </select>
    </div>
  );
}
