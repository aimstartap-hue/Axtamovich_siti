"use client";

import type { ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Check } from "lucide-react";

export interface KpiItem {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
  hint?: string;      // qo'shimcha (masalan "eng eski: 12 kun")
  accent: string;     // rangli indikator (hex)
  facet?: string;     // bosilganda jadvalni filtrlaydigan facet (kpi param)
}

// Interaktiv KPI qatori — kartani bosish jadvalni filtrlaydi (URL: kpi=...).
// Faol karta glow + border + badge bilan ajralib turadi.
export default function RequestKpis({ items }: { items: KpiItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const active = sp.get("kpi") ?? "";

  function toggle(facet?: string) {
    const p = new URLSearchParams(sp.toString());
    if (!facet || active === facet) p.delete("kpi"); else p.set("kpi", facet);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {items.map((k) => {
        const isActive = !!k.facet && active === k.facet;
        return (
          <button key={k.label} type="button" onClick={() => toggle(k.facet)} aria-pressed={isActive}
            className="relative rounded-2xl p-4 overflow-hidden text-left transition duration-200 hover:brightness-[1.08] focus:outline-none"
            style={{
              background: "var(--surface)",
              border: `1px solid ${isActive ? k.accent : "var(--border)"}`,
              boxShadow: isActive ? `0 0 0 1px ${k.accent}, 0 8px 26px ${k.accent}22` : "none",
            }}>
            <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: k.accent }} />
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--surface-2)", color: k.accent }}>{k.icon}</div>
              {isActive
                ? <span className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: k.accent, color: "#fff" }}><Check size={11} strokeWidth={3} /></span>
                : <span className="w-2 h-2 rounded-full" style={{ background: k.accent }} />}
            </div>
            <div className="mt-3 text-xl font-bold tracking-tight tabular-nums truncate" title={k.value}>{k.value}</div>
            <div className="mt-0.5 text-[11px] font-medium truncate" style={{ color: "var(--muted)" }}>{k.label}</div>
            <div className="text-[11px] truncate" style={{ color: "var(--muted)" }}>{k.sub}</div>
            {k.hint && <div className="text-[10px] mt-1 truncate" style={{ color: k.accent }}>{k.hint}</div>}
          </button>
        );
      })}
    </div>
  );
}
