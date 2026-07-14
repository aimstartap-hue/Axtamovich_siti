"use client";

import { useRef, useState } from "react";
import { formatMoney } from "@/lib/format";

export interface LinePoint { label: string; current: number; previous: number; }

const compact = (v: number) =>
  v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${Math.round(v / 1e6)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : String(Math.round(v));

// Xarajatlar dinamikasi — professional BI line chart (dark premium).
// Parent balandligiga to'liq moslashadi (height="100%") — barcha o'lchamda,
// gradient area + oldingi davr (nuqtali) + o'q belgilari + crosshair + boy tooltip.
export default function LineChart({ data, height = 340 }: { data: LinePoint[]; height?: number | string }) {
  const [hover, setHover] = useState<number | null>(null);
  const plot = useRef<HTMLDivElement>(null);

  if (data.length === 0) {
    return <div style={{ height }} className="flex items-center justify-center text-sm"><span style={{ color: "var(--muted)" }}>Bu davr uchun ma&apos;lumot yo&apos;q</span></div>;
  }

  const W = 1000, H = 320, padY = 24;
  const max = Math.max(1, ...data.map((d) => Math.max(d.current, d.previous)));
  const x = (i: number) => (data.length === 1 ? W / 2 : (i / (data.length - 1)) * W);
  const y = (v: number) => H - padY - (v / max) * (H - 2 * padY);
  const path = (sel: (d: LinePoint) => number) => data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(sel(d)).toFixed(1)}`).join(" ");
  const curLine = path((d) => d.current);
  const area = `${curLine} L${x(data.length - 1).toFixed(1)},${H - padY} L${x(0).toFixed(1)},${H - padY} Z`;
  const prevLine = path((d) => d.previous);

  const yTicks = [1, 0.66, 0.33, 0].map((f) => ({ v: max * f, top: (padY + (1 - f) * (H - 2 * padY)) / H }));
  const xCount = Math.min(6, data.length);
  const xTicks = Array.from({ length: xCount }, (_, k) => data[Math.round((k / Math.max(1, xCount - 1)) * (data.length - 1))]?.label ?? "");

  function onMove(e: React.MouseEvent) {
    const r = plot.current!.getBoundingClientRect();
    setHover(Math.max(0, Math.min(data.length - 1, Math.round(((e.clientX - r.left) / r.width) * (data.length - 1)))));
  }

  const hp = hover != null ? data[hover] : null;
  const diffAmt = hp ? hp.current - hp.previous : 0;
  const diffPct = hp && hp.previous ? Math.round((diffAmt / hp.previous) * 100) : null;
  const leftPct = hover != null ? (x(hover) / W) * 100 : 0;
  const up = diffAmt > 0;

  return (
    <div className="flex flex-col" style={{ height }}>
      <div className="flex flex-1 min-h-0">
        {/* Y o'qi belgilari */}
        <div className="w-14 shrink-0 relative">
          {yTicks.map((t, i) => (
            <div key={i} className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums" style={{ top: `${t.top * 100}%`, color: "var(--muted)" }}>{compact(t.v)}</div>
          ))}
        </div>
        {/* Plot */}
        <div ref={plot} className="flex-1 relative select-none" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" style={{ display: "block" }}>
            <defs>
              <linearGradient id="area-cur" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3987e5" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#3987e5" stopOpacity="0" />
              </linearGradient>
            </defs>
            {yTicks.map((t, i) => (
              <line key={i} x1="0" x2={W} y1={t.top * H} y2={t.top * H} stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            ))}
            <path d={area} fill="url(#area-cur)" />
            <path d={prevLine} fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" opacity="0.55" />
            <path d={curLine} fill="none" stroke="#3987e5" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
            {hover != null && <line x1={x(hover)} x2={x(hover)} y1={padY} y2={H - padY} stroke="var(--text)" strokeOpacity="0.2" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
          </svg>

          {hp && (
            <>
              <div className="absolute w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ left: `${leftPct}%`, top: `${(y(hp.current) / H) * 100}%`, background: "#3987e5", boxShadow: "0 0 0 3px rgba(57,135,229,0.25)" }} />
              <div className="absolute z-10 pointer-events-none rounded-xl px-3 py-2 text-xs shadow-xl"
                style={{ left: `${Math.min(Math.max(leftPct, 14), 86)}%`, top: 4, transform: "translateX(-50%)", background: "var(--surface)", border: "1px solid var(--border)", minWidth: 184 }}>
                <div className="font-semibold mb-1.5">{hp.label}</div>
                <Row label="Summa" value={formatMoney(hp.current)} strong />
                <Row label="Oldingi davr" value={formatMoney(hp.previous)} muted />
                {diffPct != null && (
                  <div className="mt-1 pt-1 border-t space-y-0.5" style={{ borderColor: "var(--border)" }}>
                    <div className="flex justify-between"><span style={{ color: "var(--muted)" }}>Farq</span><span className="font-semibold" style={{ color: up ? "#e66767" : "#0ca30c" }}>{up ? "+" : ""}{diffPct}%</span></div>
                    <div className="flex justify-between"><span style={{ color: "var(--muted)" }}>Farq summasi</span><span style={{ color: up ? "#e66767" : "#0ca30c" }}>{up ? "+" : ""}{formatMoney(diffAmt)}</span></div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {/* X o'qi belgilari */}
      <div className="flex mt-1.5 shrink-0">
        <div className="w-14 shrink-0" />
        <div className="flex-1 flex justify-between text-[10px]" style={{ color: "var(--muted)" }}>
          {xTicks.map((l, i) => <span key={i} className="tabular-nums">{l}</span>)}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-0.5">
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span className={strong ? "font-semibold" : ""} style={muted ? { color: "var(--muted)" } : undefined}>{value}</span>
    </div>
  );
}
