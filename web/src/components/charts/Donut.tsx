"use client";

import { useState } from "react";
import { formatMoney, formatNumber } from "@/lib/format";

export interface DonutSlice { label: string; value: number; prev?: number; color: string; }

// Donut — dark premium. Hover: sektorni ajratadi, markazda foiz. Legend: har
// sektor summasi, foizi, oldingi davrga nisbatan farqi.
export default function Donut({ data }: { data: DonutSlice[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const slices = data.filter((d) => d.value > 0);
  const total = slices.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return <div className="h-[150px] flex items-center justify-center text-sm" style={{ color: "var(--muted)" }}>Ma&apos;lumot yo&apos;q</div>;
  }

  const R = 60, C = 2 * Math.PI * R;
  const gap = slices.length > 1 ? 3 : 0;
  const arcs = slices.map((d, i) => {
    const len = (d.value / total) * C;
    const offset = slices.slice(0, i).reduce((s, x) => s + (x.value / total) * C, 0);
    return { ...d, len: Math.max(0.5, len - gap), offset };
  });
  const sh = hover != null ? slices[hover] : null;
  const centerTop = sh ? `${Math.round((sh.value / total) * 100)}%` : formatNumber(total);
  const centerSub = sh ? sh.label : "Jami";

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <svg viewBox="0 0 160 160" width="140" height="140" className="shrink-0">
        <g transform="rotate(-90 80 80)">
          {arcs.map((a, i) => (
            <circle key={i} cx="80" cy="80" r={R} fill="none" stroke={a.color}
              strokeWidth={hover === i ? 22 : 18}
              strokeDasharray={`${a.len.toFixed(2)} ${(C - a.len).toFixed(2)}`}
              strokeDashoffset={(-a.offset).toFixed(2)}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              style={{ opacity: hover == null || hover === i ? 1 : 0.35, transition: "opacity .15s, stroke-width .15s", cursor: "pointer" }} />
          ))}
        </g>
        <text x="80" y="78" textAnchor="middle" fill="var(--text)" fontSize="18" fontWeight="700">{centerTop}</text>
        <text x="80" y="96" textAnchor="middle" fill="var(--muted)" fontSize="9">{centerSub}</text>
      </svg>

      <div className="flex-1 min-w-[220px] space-y-2.5">
        {arcs.map((a, i) => {
          const pct = Math.round((a.value / total) * 100);
          const dAmt = a.prev != null ? a.value - a.prev : null;
          const dPct = a.prev != null && a.prev > 0 ? Math.round((dAmt! / a.prev) * 100) : null;
          const up = (dAmt ?? 0) > 0;
          return (
            <div key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              style={{ opacity: hover == null || hover === i ? 1 : 0.5 }}>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: a.color }} />
                <span className="flex-1 truncate">{a.label}</span>
                <span className="font-medium tabular-nums">{formatMoney(a.value)}</span>
              </div>
              <div className="flex justify-between gap-2 pl-4 mt-0.5 text-[11px]" style={{ color: "var(--muted)" }}>
                <span className="tabular-nums">{pct}% · oldingi {a.prev != null ? formatMoney(a.prev) : "—"}</span>
                {dPct != null && (
                  <span className="tabular-nums shrink-0" style={{ color: up ? "#e66767" : "#0ca30c" }}>
                    {up ? "▲" : "▼"}{Math.abs(dPct)}% ({up ? "+" : ""}{formatMoney(dAmt!)})
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
