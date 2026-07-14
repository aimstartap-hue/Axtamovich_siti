"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, X, FileText, Check, Minus, CircleCheck, CircleDot, Image as ImageIcon } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { LEVEL_META, type RiskResult, type RiskLevel, type RiskFinding } from "@/lib/risk/types";
import RiskCell from "@/components/risk/RiskCell";
import RequestRiskDrawer, { type RequestRiskInfo } from "@/components/risk/RequestRiskDrawer";

export interface StageState { key: string; label: string; done: boolean }
export interface CategoryLine { name: string; plan: number; spent: number }
export interface OpeningEvent { action: string; who: string; at: string; comment: string | null }
export interface OpeningExpense { date: string; reqId: number; name: string; category: string | null; amount: number; supplier: string | null; employee: string; hasReceipt: boolean; hasPhoto: boolean; findings: RiskFinding[]; riskLevel: RiskLevel }
export interface OpeningProject {
  id: number; title: string; project: string | null; manager: string; address: string;
  startDate: string; plannedDate: string; actualDate: string;
  statusLabel: string; statusTone: RiskLevel | "info"; note: string;
  stages: StageState[]; progress: number; currentStage: string; budget: number; spent: number; remaining: number;
  risk: RiskResult; facets: string[]; timeline: OpeningEvent[]; categories: CategoryLine[]; expenses: OpeningExpense[]; photoCount: number;
}

const TONE: Record<string, string> = { good: "#22c55e", attention: "#fbbf24", risk: "#fb923c", critical: "#f87171", info: "#4f9bf5" };

export default function OpeningsBoard({ projects }: { projects: OpeningProject[] }) {
  const sp = useSearchParams();
  const kpi = sp.get("kpi") ?? "";
  const [drill, setDrill] = useState<OpeningProject | null>(null);

  const rows = kpi ? projects.filter((p) => p.facets.includes(kpi)) : projects;

  if (projects.length === 0) {
    return <div className="rounded-2xl p-12 text-center text-sm" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}>Ochilish loyihasi topilmadi.</div>;
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs" style={{ color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
              <th className="font-medium px-4 py-3">Filial</th>
              <th className="font-medium px-3 py-3 hidden lg:table-cell">Mas&apos;ul</th>
              <th className="font-medium px-3 py-3 hidden xl:table-cell">Boshlangan</th>
              <th className="font-medium px-3 py-3 hidden xl:table-cell">Reja ochilish</th>
              <th className="font-medium px-3 py-3 min-w-[180px]">Progress</th>
              <th className="font-medium px-3 py-3 text-right">Byudjet</th>
              <th className="font-medium px-3 py-3 text-right hidden md:table-cell">Sarflangan</th>
              <th className="font-medium px-3 py-3 text-right hidden lg:table-cell">Qoldiq</th>
              <th className="font-medium px-3 py-3">AI</th>
              <th className="font-medium px-3 py-3 text-right pr-4">Amal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const done = p.stages.filter((s) => s.done).length;
              const overBudget = p.budget > 0 && p.spent > p.budget;
              return (
                <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.title}</div>
                    <div className="text-[11px]" style={{ color: "var(--muted)" }}>{p.address}</div>
                  </td>
                  <td className="px-3 py-3 hidden lg:table-cell whitespace-nowrap">{p.manager}</td>
                  <td className="px-3 py-3 hidden xl:table-cell whitespace-nowrap tabular-nums" style={{ color: "var(--muted)" }}>{p.startDate}</td>
                  <td className="px-3 py-3 hidden xl:table-cell whitespace-nowrap tabular-nums" style={{ color: "var(--muted)" }}>{p.plannedDate}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-semibold tabular-nums" style={{ color: p.progress >= 100 ? "#22c55e" : "var(--text)" }}>{p.progress}%</span>
                      <span style={{ color: "var(--muted)" }}>{done}/{p.stages.length} bosqich</span>
                    </div>
                    <div className="flex gap-0.5 mb-1" title={`${p.progress}% (vaznli) · ${done}/${p.stages.length} bosqich`}>
                      {p.stages.map((s) => <span key={s.key} className="h-1.5 flex-1 rounded-sm" style={{ background: s.done ? "var(--brand)" : "var(--surface-2)" }} />)}
                    </div>
                    <div className="text-[11px] truncate" style={{ color: "var(--muted)" }}>{p.currentStage}</div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">{formatMoney(p.budget)}</td>
                  <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap hidden md:table-cell font-medium">{formatMoney(p.spent)}</td>
                  <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap hidden lg:table-cell" style={{ color: overBudget ? "#f87171" : "var(--muted)" }}>{formatMoney(p.remaining)}</td>
                  <td className="px-3 py-3"><RiskCell subject={p.title} result={p.risk} /></td>
                  <td className="px-3 py-3 pr-4 text-right">
                    <button onClick={() => setDrill(p)} className="p-1.5 rounded-lg hover:bg-surface-2 transition" title="Ochish" aria-label="Ochish"><Eye size={16} style={{ color: "var(--muted)" }} /></button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={10} className="px-4 py-10 text-center text-sm" style={{ color: "var(--muted)" }}>Bu filter bo&apos;yicha loyiha yo&apos;q.</td></tr>}
          </tbody>
        </table>
      </div>

      {drill && <ProjectDrawer p={drill} onClose={() => setDrill(null)} />}
    </div>
  );
}

// ---- Eye drawer: Umumiy · Timeline · Kategoriya · Xarajatlar ----
type Tab = "info" | "timeline" | "categories" | "expenses";
function ProjectDrawer({ p, onClose }: { p: OpeningProject; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("info");
  const [reqInfo, setReqInfo] = useState<RequestRiskInfo | null>(null);
  const meta = LEVEL_META[p.risk.level];

  const openExpense = (e: OpeningExpense) => setReqInfo({ reqId: e.reqId, hasReceipt: e.hasReceipt, hasPhoto: e.hasPhoto, items: [{ name: e.name, category: e.category, amount: e.amount, supplier: e.supplier, findings: e.findings }] });

  const TABS: { id: Tab; label: string }[] = [
    { id: "info", label: "Umumiy" }, { id: "timeline", label: "Timeline" }, { id: "categories", label: "Xarajatlar" }, { id: "expenses", label: `Ro'yxat (${p.expenses.length})` },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40 animate-fade" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose} />
      <aside className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-2xl flex flex-col animate-drawer" role="dialog" aria-modal="true" aria-label={`${p.title} ochilish`}
        style={{ background: "var(--surface)", borderLeft: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 h-14 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          <div className="min-w-0">
            <div className="font-semibold truncate">{p.title}</div>
            <div className="text-xs" style={{ color: "var(--muted)" }}>{p.address} · {p.statusLabel}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 shrink-0" aria-label="Yopish"><X size={18} /></button>
        </div>

        <div className="flex gap-1 px-4 pt-3 shrink-0">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} aria-pressed={tab === t.id}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition" style={tab === t.id ? { background: "var(--brand)", color: "var(--brand-fg)" } : { background: "var(--surface-2)", color: "var(--muted)" }}>{t.label}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === "info" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Filial" value={p.title} />
                <Field label="Mas'ul" value={p.manager} />
                <Field label="Manzil" value={p.address} />
                <Field label="Holat" value={p.statusLabel} color={TONE[p.statusTone]} />
                <Field label="Boshlangan" value={p.startDate} />
                <Field label="Reja ochilish" value={p.plannedDate} />
                <Field label="Haqiqiy ochilish" value={p.actualDate} />
                <Field label="AI Risk" value={`${meta.dot} ${meta.label} · ${p.risk.score}/100`} color={meta.color} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>Progress (vaznli)</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: p.progress >= 100 ? "#22c55e" : "var(--brand)" }}>{p.progress}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden mb-4" style={{ background: "var(--surface-2)" }}>
                  <div className="h-full rounded-full" style={{ width: `${p.progress}%`, background: p.progress >= 100 ? "#22c55e" : "linear-gradient(90deg,#2563eb,#60a5fa)", transition: "width .6s cubic-bezier(.16,1,.3,1)" }} />
                </div>
                <div className="text-xs font-medium mb-2" style={{ color: "var(--muted)" }}>Bosqichlar ({p.stages.filter((s) => s.done).length}/{p.stages.length})</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {p.stages.map((s) => (
                    <div key={s.key} className="flex items-center gap-1.5 text-xs rounded-lg px-2 py-1.5" style={{ background: "var(--surface-2)", color: s.done ? "var(--text)" : "var(--muted)" }}>
                      {s.done ? <Check size={13} style={{ color: "#22c55e" }} /> : <Minus size={13} style={{ opacity: .5 }} />}{s.label}
                    </div>
                  ))}
                </div>
              </div>
              {p.note && <Field label="Izoh" value={p.note} />}
            </div>
          )}

          {tab === "timeline" && (
            p.timeline.length === 0 ? <Empty /> : (
              <ol className="relative">
                {p.timeline.map((e, i) => {
                  const last = i === p.timeline.length - 1;
                  return (
                    <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
                      {!last && <span className="absolute left-[9px] top-6 bottom-0 w-px" style={{ background: "var(--border)" }} />}
                      <span className="shrink-0 mt-0.5" style={{ color: last ? "var(--brand)" : "var(--muted)" }}>{last ? <CircleDot size={20} /> : <CircleCheck size={20} />}</span>
                      <div className="min-w-0"><div className="text-sm font-medium">{e.action}</div><div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{e.who} · {e.at}</div>{e.comment && <div className="mt-1 text-xs rounded-lg px-2.5 py-1.5" style={{ background: "var(--surface-2)" }}>{e.comment}</div>}</div>
                    </li>
                  );
                })}
              </ol>
            )
          )}

          {tab === "categories" && (
            p.categories.length === 0 ? <Empty text="Kategoriya byudjeti belgilanmagan." /> : (
              <div className="space-y-3">
                {p.categories.map((c) => {
                  const over = c.plan > 0 && c.spent > c.plan;
                  const pct = c.plan ? Math.min(100, Math.round((c.spent / c.plan) * 100)) : 0;
                  return (
                    <div key={c.name}>
                      <div className="flex justify-between text-sm mb-1"><span>{c.name}</span><span className="tabular-nums" style={{ color: over ? "#f87171" : "var(--muted)" }}>{formatMoney(c.spent)} / {formatMoney(c.plan)}</span></div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}><div className="h-full rounded-full" style={{ width: `${pct}%`, background: over ? "#f87171" : "var(--brand)" }} /></div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {tab === "expenses" && (
            p.expenses.length === 0 ? <Empty text="Xarajat yo'q." /> : (
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                {p.expenses.map((e, i) => {
                  const em = LEVEL_META[e.riskLevel];
                  const risky = e.riskLevel !== "good";
                  return (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5 text-sm" style={{ borderTop: i ? "1px solid var(--border)" : "none" }}>
                      <span className="text-[11px] tabular-nums shrink-0 w-16" style={{ color: "var(--muted)" }}>{e.date}</span>
                      <div className="flex-1 min-w-0"><div className="truncate font-medium">{e.name}</div><div className="text-[11px] truncate" style={{ color: "var(--muted)" }}>{[e.category, e.supplier, e.employee].filter(Boolean).join(" · ")}</div></div>
                      <span title="Chek/hisobot">{e.hasReceipt ? <Check size={13} style={{ color: "#22c55e" }} /> : <Minus size={13} style={{ color: "#f87171" }} />}</span>
                      <span title="Foto"><ImageIcon size={13} style={{ color: e.hasPhoto ? "#22c55e" : "#f87171" }} /></span>
                      <span className="tabular-nums font-medium shrink-0 w-24 text-right">{formatMoney(e.amount)}</span>
                      {risky
                        ? <button onClick={() => openExpense(e)} className="p-1 rounded-lg hover:bg-surface-2 shrink-0" title="AI tahlil" aria-label="AI tahlil"><FileText size={15} style={{ color: em.color }} /></button>
                        : <span className="w-[23px] shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </aside>

      <RequestRiskDrawer info={reqInfo} onClose={() => setReqInfo(null)} />
    </>
  );
}

function Field({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div><div className="text-[11px]" style={{ color: "var(--muted)" }}>{label}</div><div className="text-sm font-medium" style={color ? { color } : undefined}>{value || "—"}</div></div>;
}
function Empty({ text = "Ma'lumot yo'q." }: { text?: string }) {
  return <div className="text-center py-8 text-sm" style={{ color: "var(--muted)" }}>{text}</div>;
}
