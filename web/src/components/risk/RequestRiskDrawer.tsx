"use client";

import { useEffect } from "react";
import { X, Check, Minus, FileText } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { finalize } from "@/lib/risk/engine";
import { LEVEL_META, type RiskFinding, type RiskLevel } from "@/lib/risk/types";

export interface RequestItem { name: string; category: string | null; amount: number; supplier: string | null; findings: RiskFinding[] }
export interface RequestRiskInfo { reqId: number; hasReceipt: boolean; hasPhoto: boolean; items: RequestItem[] }

// Risk darajasi yorlig'i (spec: Past / O'rta / Yuqori / Kritik)
const RISK_LABEL: Record<RiskLevel, string> = { good: "Past", attention: "O'rta", risk: "Yuqori", critical: "Kritik" };

// Zayavka darajasida AI tahlil drawer'i. Sabablar mavjud AI Risk Engine'dan
// (finalize) — hardcode emas.
export default function RequestRiskDrawer({ info, onClose }: { info: RequestRiskInfo | null; onClose: () => void }) {
  useEffect(() => {
    if (!info) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [info, onClose]);

  if (!info) return null;

  // Zayavkaning barcha topilmalarini birlashtirish (takroriy sarlavhalar bir marta)
  const seen = new Set<string>();
  const all: RiskFinding[] = [];
  for (const it of info.items) for (const f of it.findings) if (!seen.has(f.title)) { seen.add(f.title); all.push(f); }
  const result = finalize(all);
  const meta = LEVEL_META[result.level];
  const total = info.items.reduce((s, i) => s + i.amount, 0);

  return (
    <>
      <div className="fixed inset-0 z-40 animate-fade" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose} />
      <aside className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md flex flex-col animate-drawer" role="dialog" aria-modal="true" aria-label={`Zayavka #${info.reqId} AI tahlil`}
        style={{ background: "var(--surface)", borderLeft: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 h-14 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 font-semibold"><FileText size={17} style={{ color: meta.color }} /> Zayavka #{info.reqId}</div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2" aria-label="Yopish"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Risk darajasi + ball */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0" style={{ background: `${meta.color}1f`, color: meta.color }}>
              <span className="text-xl font-bold leading-none tabular-nums">{result.score}</span>
              <span className="text-[9px] mt-0.5">/ 100</span>
            </div>
            <div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>Risk darajasi</div>
              <div className="text-lg font-semibold" style={{ color: meta.color }}>{meta.dot} {RISK_LABEL[result.level]}</div>
            </div>
          </div>

          {/* AI xulosasi */}
          <div>
            <div className="text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>AI xulosasi</div>
            <div className="text-sm leading-relaxed rounded-xl p-3" style={{ background: `${meta.color}12`, border: `1px solid ${meta.color}33` }}>{result.recommendation}</div>
          </div>

          {/* Aniqlangan xavflar (badge + tafsilot) */}
          <div>
            <div className="text-xs font-medium mb-2" style={{ color: "var(--muted)" }}>Aniqlangan xavflar</div>
            {result.findings.length === 0 ? (
              <div className="text-sm rounded-xl p-3" style={{ background: "var(--surface-2)" }}>Xavf aniqlanmadi ✅</div>
            ) : (
              <ul className="space-y-2">
                {result.findings.map((f, i) => {
                  const fm = LEVEL_META[f.level];
                  return (
                    <li key={i} className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: `${fm.color}22`, color: fm.color }}>{fm.dot} {f.title}</span>
                      <div className="text-xs mt-1.5" style={{ color: "var(--muted)" }}>{f.detail}</div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Hujjatlar */}
          <div>
            <div className="text-xs font-medium mb-2" style={{ color: "var(--muted)" }}>Hujjatlar</div>
            <div className="flex gap-2">
              <DocChip ok={info.hasReceipt} label="Chek / hisobot" />
              <DocChip ok={info.hasPhoto} label="Foto hisobot" />
            </div>
          </div>

          {/* Xaridlar */}
          <div>
            <div className="text-xs font-medium mb-2" style={{ color: "var(--muted)" }}>Xaridlar ({info.items.length}) · jami {formatMoney(total)}</div>
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              {info.items.map((it, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5" style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{it.name}</div>
                    <div className="text-[11px] truncate" style={{ color: "var(--muted)" }}>{[it.category, it.supplier].filter(Boolean).join(" · ") || "—"}</div>
                  </div>
                  <div className="text-sm font-medium tabular-nums shrink-0">{formatMoney(it.amount)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function DocChip({ ok, label }: { ok: boolean; label: string }) {
  const color = ok ? "#22c55e" : "#f87171";
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs" style={{ background: `${color}18`, color }}>
      {ok ? <Check size={13} /> : <Minus size={13} />} {label}
    </span>
  );
}
