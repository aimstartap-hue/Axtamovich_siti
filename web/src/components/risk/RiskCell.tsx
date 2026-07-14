"use client";

import { useEffect, useState } from "react";
import { X, ShieldAlert } from "lucide-react";
import { LEVEL_META, type RiskResult } from "@/lib/risk/types";

// Holat ustuni — AI Risk badge. Bosilganda "AI Risk Analysis" modali ochiladi.
export default function RiskCell({ subject, result }: { subject: string; result: RiskResult }) {
  const [open, setOpen] = useState(false);
  const meta = LEVEL_META[result.level];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label={`${subject} — risk tahlili`}
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap transition hover:brightness-110"
        style={{ background: `${meta.color}22`, color: meta.color }}>
        <span>{meta.dot}</span>{meta.label}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 animate-fade" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
            <div role="dialog" aria-modal="true" aria-label="AI Risk tahlili" onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl flex flex-col max-h-[85vh] animate-fade" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between px-5 h-14 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2 font-semibold"><ShieldAlert size={17} style={{ color: meta.color }} /> AI Risk Analysis</div>
                <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-surface-2" aria-label="Yopish"><X size={18} /></button>
              </div>

              <div className="p-5 overflow-y-auto space-y-5">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0" style={{ background: `${meta.color}1f`, color: meta.color }}>
                    <span className="text-xl font-bold leading-none tabular-nums">{result.score}</span>
                    <span className="text-[9px] mt-0.5">/ 100</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm truncate" style={{ color: "var(--muted)" }}>{subject}</div>
                    <div className="text-lg font-semibold" style={{ color: meta.color }}>{meta.dot} {meta.label}</div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium mb-2" style={{ color: "var(--muted)" }}>Aniqlangan muammolar</div>
                  {result.findings.length === 0 ? (
                    <div className="text-sm rounded-xl p-3" style={{ background: "var(--surface-2)" }}>Xavf aniqlanmadi ✅</div>
                  ) : (
                    <ul className="space-y-2">
                      {result.findings.map((f, i) => {
                        const fm = LEVEL_META[f.level];
                        return (
                          <li key={i} className="flex items-start gap-2.5 rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
                            <span className="mt-0.5 text-sm">{fm.dot}</span>
                            <div className="min-w-0">
                              <div className="text-sm font-medium">{f.title}</div>
                              <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{f.detail}</div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div>
                  <div className="text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>AI tavsiyasi</div>
                  <div className="text-sm leading-relaxed rounded-xl p-3" style={{ background: `${meta.color}12`, border: `1px solid ${meta.color}33` }}>{result.recommendation}</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
