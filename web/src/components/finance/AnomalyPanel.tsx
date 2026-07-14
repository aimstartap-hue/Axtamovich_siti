"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/format";
import { formatDate } from "@/lib/workflow";
import type { Anomaly, Sev } from "@/lib/anomalies";

const SEV: Record<Sev, { dot: string; label: string; bg: string }> = {
  critical: { dot: "🔴", label: "Kritik", bg: "#d03b3b" },
  serious: { dot: "🟠", label: "Jiddiy", bg: "#ec835a" },
  warning: { dot: "🟡", label: "Ogohlantirish", bg: "#fab219" },
};

// Har bir anomaliya turi uchun qisqa tavsiya (nima qilish kerak).
function advice(a: Anomaly): string {
  const t = a.title.toLowerCase();
  if (t.includes("byudjet")) return "Filial byudjetini qayta ko'rib chiqing yoki ortiqcha xarajat sababini so'rang.";
  if (t.includes("arzon")) return "Xaridni eng arzon ta'minotchiga o'tkazishni ko'rib chiqing.";
  if (t.includes("filiallarda")) return "Filiallar bir xil mahsulotni turli narxda olyapti — markazlashtirilgan xarid tekshiring.";
  if (t.includes("konsentratsiya")) return "Bitta ta'minotchiga bog'liqlik yuqori — muqobil ta'minotchilar qidiring.";
  if (t.includes("narx oshdi")) return "Narx keskin oshgan — chek va ta'minotchi bilan sababini aniqlang.";
  if (t.includes("kategoriya")) return "Kategoriya xarajati keskin oshgan — tarkibini tekshiring.";
  return "Xarajatni tekshirib, sababini aniqlang.";
}

// "Diqqat talab qiladi" AI paneli — kartani bosganda o'ng tomondan drawer ochiladi.
export default function AnomalyPanel({ anomalies }: { anomalies: Anomaly[] }) {
  const [sel, setSel] = useState<number | null>(null);
  const open = sel != null ? anomalies[sel] : null;

  useEffect(() => {
    if (sel == null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSel(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel]);

  return (
    <section className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-semibold">Diqqat talab qiladi</h2>
        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>AI tahlil</span>
        {anomalies.length > 0 && <span className="text-xs ml-auto" style={{ color: "var(--muted)" }}>{anomalies.length} ta signal</span>}
      </div>

      {anomalies.length === 0 ? (
        <div className="text-center py-8 text-sm" style={{ color: "var(--muted)" }}>Anomaliya topilmadi — barcha xarajatlar normal ✅</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
          {anomalies.map((a, i) => (
            <button key={i} onClick={() => setSel(i)}
              className="flex items-start gap-3 rounded-xl p-3.5 text-left transition hover:brightness-110"
              style={{ background: "var(--surface-2)", border: "1px solid transparent" }}>
              <span className="text-sm mt-0.5">{SEV[a.sev].dot}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{a.title}</div>
                <div className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--muted)" }}>{a.detail}</div>
              </div>
              <span className="text-xs shrink-0 mt-0.5" style={{ color: "var(--muted)" }}>›</span>
            </button>
          ))}
        </div>
      )}

      {/* Drawer */}
      {open && (
        <>
          <div className="fixed inset-0 z-40 animate-fade" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setSel(null)} />
          <aside className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md flex flex-col animate-drawer"
            style={{ background: "var(--surface)", borderLeft: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between px-5 h-14 border-b" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${SEV[open.sev].bg}22`, color: SEV[open.sev].bg }}>
                  {SEV[open.sev].dot} {SEV[open.sev].label}
                </span>
              </div>
              <button onClick={() => setSel(null)} className="text-xl leading-none" style={{ color: "var(--muted)" }} aria-label="Yopish">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div>
                <h3 className="text-lg font-semibold">{open.title}</h3>
                <div className="text-sm mt-1" style={{ color: "var(--muted)" }}>{open.detail}</div>
              </div>

              {/* Xarid tarixi — hisobot ko'rinishida (sana · narx · kim oldi) */}
              {open.history && open.history.length > 0 && (() => {
                const maxPrice = Math.max(...open.history!.map((h) => h.price));
                return (
                  <div>
                    <div className="text-xs mb-2 font-medium" style={{ color: "var(--muted)" }}>Xarid tarixi ({open.history!.length} ta)</div>
                    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                      {open.history!.map((h, i) => {
                        const hi = h.price === maxPrice && open.history!.length > 1;
                        return (
                          <div key={i} className="flex items-center gap-3 px-3.5 py-2.5"
                            style={{ borderTop: i ? "1px solid var(--border)" : "none", background: hi ? "#d03b3b18" : "transparent" }}>
                            <div className="w-20 shrink-0 text-xs tabular-nums" style={{ color: "var(--muted)" }}>{formatDate(h.date)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm truncate">{h.who ?? "—"}</div>
                              {(h.supplier || h.branch) && (
                                <div className="text-[11px] truncate" style={{ color: "var(--muted)" }}>
                                  {[h.branch, h.supplier].filter(Boolean).join(" · ")}
                                </div>
                              )}
                            </div>
                            <div className="text-sm font-semibold tabular-nums shrink-0" style={{ color: hi ? "#e66767" : "var(--text)" }}>{formatMoney(h.price)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div>
                <div className="text-xs mb-1.5" style={{ color: "var(--muted)" }}>Tavsiya</div>
                <div className="text-sm leading-relaxed">{advice(open)}</div>
              </div>
            </div>

            <div className="p-4 border-t flex gap-2" style={{ borderColor: "var(--border)" }}>
              {open.href && <Link href={open.href} className="btn btn-brand !py-2 text-sm flex-1 text-center">Tafsilotni ochish</Link>}
              <button onClick={() => setSel(null)} className="btn btn-ghost !py-2 text-sm flex-1">Yopish</button>
            </div>
          </aside>
        </>
      )}
    </section>
  );
}
