"use client";

import { LEVEL_META, type RiskLevel } from "@/lib/risk/types";

export interface SummaryItem { ruleId: string; label: string; count: number; unit: string; level: RiskLevel }

// AI Risk Summary — o'ng panel widget. Har qatorni bosish jadvalni filtrlaydi.
export default function RiskSummary({ items, active, onSelect }: { items: SummaryItem[]; active: string; onSelect: (ruleId: string) => void }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="text-sm font-semibold mb-3">AI Risk Summary</div>
      <div className="space-y-2">
        {items.every((i) => i.count === 0) && (
          <div className="text-xs text-center py-4" style={{ color: "var(--muted)" }}>Xavf aniqlanmadi ✅</div>
        )}
        {items.filter((i) => i.count > 0).map((i) => {
          const meta = LEVEL_META[i.level];
          const isActive = active === i.ruleId;
          return (
            <button key={i.ruleId} onClick={() => onSelect(i.ruleId)} aria-pressed={isActive}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:brightness-110"
              style={{ background: "var(--surface-2)", border: `1px solid ${isActive ? meta.color : "transparent"}` }}>
              <span className="text-sm">{meta.dot}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{i.label}</div>
                <div className="text-[11px]" style={{ color: "var(--muted)" }}>{i.count} {i.unit}</div>
              </div>
              <span className="text-lg font-bold tabular-nums" style={{ color: meta.color }}>{i.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
