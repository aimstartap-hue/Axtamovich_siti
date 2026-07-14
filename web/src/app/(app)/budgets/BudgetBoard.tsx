"use client";

import { useState } from "react";
import { Eye, Trash2, X, Check, Minus, FileText, ChevronRight } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { LEVEL_META, type RiskResult, type RiskLevel, type RiskFinding } from "@/lib/risk/types";
import RiskCell from "@/components/risk/RiskCell";
import RiskSummary, { type SummaryItem } from "@/components/risk/RiskSummary";
import RequestRiskDrawer, { type RequestRiskInfo } from "@/components/risk/RequestRiskDrawer";

export interface BudgetExpense { date: string; reqId: number; name: string; category: string | null; branch: string; amount: number; supplier: string | null; employee: string; hasReceipt: boolean; hasPhoto: boolean; statusLabel: string; findings: RiskFinding[]; riskLevel: RiskLevel }
export interface BudgetRow { key: string; scope: string; label: string; subtitle: string; limitId: number; limit: number; spent: number; pct: number; risk: RiskResult; expenses: BudgetExpense[]; findingRules: string[] }
export interface RiskyRequest extends RequestRiskInfo { date: string; employee: string; position: string; branch: string; amount: number; riskLevel: RiskLevel; ruleIds: string[]; topReason: string }

// Yuqori darajadagi bo'limlar (spec bo'yicha)
const TABS: { id: string; label: string; icon: string }[] = [
  { id: "role", label: "Lavozim", icon: "🎫" },
  { id: "user", label: "Shaxs", icon: "👤" },
  { id: "branch", label: "Filial", icon: "🏢" },
  { id: "category", label: "Kategoriya", icon: "🏷" },
  { id: "ai", label: "AI Risk", icon: "🤖" },
  { id: "stats", label: "Statistika", icon: "📊" },
];
// AI Risk ichki filtrlari
const AI_FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "Barchasi" },
  { id: "limit", label: "Limitdan oshgan" },
  { id: "price", label: "Narx anomaliyasi" },
  { id: "repeat", label: "Takroriy xarid" },
  { id: "nochek", label: "Chek yo'q" },
  { id: "nofoto", label: "Foto yo'q" },
  { id: "advice", label: "AI tavsiyalari" },
];
const SCOPE_HEAD: Record<string, string> = { role: "Lavozim", user: "Shaxs", branch: "Filial", category: "Kategoriya" };

export default function BudgetBoard({ rows, riskyRequests, summary, deleteLimit }: { rows: BudgetRow[]; riskyRequests: RiskyRequest[]; summary: SummaryItem[]; deleteLimit: (fd: FormData) => Promise<void> }) {
  const [tab, setTab] = useState("role");
  const [aiFilter, setAiFilter] = useState("all");
  const [drill, setDrill] = useState<BudgetRow | null>(null);
  const [reqInfo, setReqInfo] = useState<RequestRiskInfo | null>(null);

  const scopeRows = rows.filter((r) => r.scope === tab);
  const filterRisky = (id: string): RiskyRequest[] => {
    if (id === "all" || id === "advice") return riskyRequests;
    if (id === "nochek") return riskyRequests.filter((r) => !r.hasReceipt);
    if (id === "nofoto") return riskyRequests.filter((r) => !r.hasPhoto);
    return riskyRequests.filter((r) => r.ruleIds.includes(id));
  };

  return (
    <div className="space-y-4">
      {/* Bo'lim tablari */}
      <div className="flex flex-wrap gap-1.5 p-1 rounded-2xl" style={{ background: "var(--surface-2)", width: "fit-content", maxWidth: "100%" }}>
        {TABS.map((t) => {
          const on = tab === t.id;
          const badge = t.id === "ai" ? riskyRequests.length : t.id === "stats" ? undefined : rows.filter((r) => r.scope === t.id).length;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} aria-pressed={on}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition"
              style={on ? { background: "var(--surface)", color: "var(--text)", boxShadow: "0 1px 3px rgba(0,0,0,.15)" } : { color: "var(--muted)" }}>
              <span className="text-base leading-none">{t.icon}</span>{t.label}
              {badge != null && badge > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: t.id === "ai" ? "#ef444422" : "var(--surface-2)", color: t.id === "ai" ? "#ef4444" : "var(--muted)" }}>{badge}</span>}
            </button>
          );
        })}
      </div>

      {tab === "stats" ? (
        <StatsPanel rows={rows} riskyRequests={riskyRequests} />
      ) : tab === "ai" ? (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4 items-start">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {AI_FILTERS.map((f) => (
                <button key={f.id} onClick={() => setAiFilter(f.id)} aria-pressed={aiFilter === f.id}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium transition"
                  style={aiFilter === f.id ? { background: "var(--brand)", color: "var(--brand-fg)" } : { background: "var(--surface-2)", color: "var(--muted)" }}>
                  {f.label}
                </button>
              ))}
            </div>
            <RequestList requests={filterRisky(aiFilter)} onOpen={setReqInfo} advice={aiFilter === "advice"} />
          </div>
          <RiskSummary items={summary} active={aiFilter} onSelect={(id) => setAiFilter((f) => (f === id ? "all" : id))} />
        </div>
      ) : (
        scopeRows.length === 0 ? (
          <div className="rounded-2xl p-10 text-center text-sm" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}>
            {SCOPE_HEAD[tab]} budjeti hali belgilanmagan — yuqoridagi formadan qo&apos;shing.
          </div>
        ) : (
          <PositionTable positions={scopeRows} head={SCOPE_HEAD[tab] ?? ""} onDrill={setDrill} deleteLimit={deleteLimit} />
        )
      )}

      {drill && <ExpenseModal p={drill} onOpenRequest={setReqInfo} onClose={() => setDrill(null)} />}
      <RequestRiskDrawer info={reqInfo} onClose={() => setReqInfo(null)} />
    </div>
  );
}

// --- Statistika paneli ---
function StatsPanel({ rows, riskyRequests }: { rows: BudgetRow[]; riskyRequests: RiskyRequest[] }) {
  const totalLimit = rows.reduce((s, r) => s + r.limit, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
  const overCount = rows.filter((r) => r.pct >= 100).length;
  const usedPct = totalLimit ? Math.round((totalSpent / totalLimit) * 100) : 0;
  const byScope = ["role", "user", "branch", "category"].map((sc) => ({
    label: SCOPE_HEAD[sc], spent: rows.filter((r) => r.scope === sc).reduce((s, r) => s + r.spent, 0),
    count: rows.filter((r) => r.scope === sc).length,
  }));
  const maxScope = Math.max(1, ...byScope.map((b) => b.spent));
  const cards = [
    { label: "Jami budjet", value: formatMoney(totalLimit), tone: "var(--brand)" },
    { label: "Sarflangan", value: formatMoney(totalSpent), tone: "#22c55e" },
    { label: "Ishlatilgan", value: `${usedPct}%`, tone: usedPct >= 90 ? "#ef4444" : "#f59e0b" },
    { label: "Limitdan oshgan", value: `${overCount} ta`, tone: overCount ? "#ef4444" : "var(--muted)" },
    { label: "Xavfli zayavka", value: `${riskyRequests.length} ta`, tone: riskyRequests.length ? "#ef4444" : "var(--muted)" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="text-lg font-bold tabular-nums" style={{ color: c.tone }}>{c.value}</div>
            <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>{c.label}</div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h3 className="text-sm font-semibold mb-4">Sarf — tur bo&apos;yicha</h3>
        <div className="space-y-3">
          {byScope.map((b) => (
            <div key={b.label}>
              <div className="flex items-center justify-between text-[13px] mb-1">
                <span>{b.label} <span style={{ color: "var(--muted)" }}>· {b.count} ta</span></span>
                <span className="font-semibold tabular-nums">{formatMoney(b.spent)}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                <div className="h-full rounded-full" style={{ width: `${Math.max((b.spent / maxScope) * 100, b.spent > 0 ? 5 : 0)}%`, background: "linear-gradient(90deg,#2563eb,#60a5fa)", transition: "width .6s cubic-bezier(.16,1,.3,1)" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Budjet jadvali (limit nazorati) ---
function PositionTable({ positions, head, onDrill, deleteLimit }: { positions: BudgetRow[]; head: string; onDrill: (p: BudgetRow) => void; deleteLimit: (fd: FormData) => Promise<void> }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs" style={{ color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
              <th className="font-medium px-4 py-3">{head}</th>
              <th className="font-medium px-3 py-3 text-right">Limit</th>
              <th className="font-medium px-3 py-3 text-right">Sarflangan</th>
              <th className="font-medium px-3 py-3 text-right hidden sm:table-cell">Qoldiq</th>
              <th className="font-medium px-3 py-3 w-32">Ishlatilgan</th>
              <th className="font-medium px-3 py-3">Holat (AI)</th>
              <th className="font-medium px-3 py-3 text-right pr-4">Amallar</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const remaining = p.limit - p.spent;
              const over = p.pct >= 100;
              const barColor = over ? "#f87171" : p.pct >= 90 ? "#fb923c" : p.pct >= 75 ? "#fbbf24" : "#22c55e";
              return (
                <tr key={p.key} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-4 py-3"><div className="font-medium">{p.label}</div><div className="text-[11px]" style={{ color: "var(--muted)" }}>{p.subtitle}</div></td>
                  <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">{formatMoney(p.limit)}</td>
                  <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap font-medium">{formatMoney(p.spent)}</td>
                  <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap hidden sm:table-cell" style={{ color: remaining < 0 ? "#f87171" : "var(--muted)" }}>{formatMoney(remaining)}</td>
                  <td className="px-3 py-3"><div className="flex items-center gap-2"><div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}><div className="h-full rounded-full" style={{ width: `${Math.min(p.pct, 100)}%`, background: barColor }} /></div><span className="text-[11px] tabular-nums shrink-0" style={{ color: barColor }}>{p.pct}%</span></div></td>
                  <td className="px-3 py-3"><RiskCell subject={p.label} result={p.risk} /></td>
                  <td className="px-3 py-3 pr-4"><div className="flex items-center justify-end gap-1">
                    <button onClick={() => onDrill(p)} className="p-1.5 rounded-lg hover:bg-surface-2 transition" title="Xarajatlar" aria-label="Xarajatlar"><Eye size={16} style={{ color: "var(--muted)" }} /></button>
                    <form action={deleteLimit}><input type="hidden" name="id" value={p.limitId} /><button className="p-1.5 rounded-lg hover:bg-surface-2 transition" title="O'chirish" aria-label="O'chirish"><Trash2 size={15} style={{ color: "#f87171" }} /></button></form>
                  </div></td>
                </tr>
              );
            })}
            {positions.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm" style={{ color: "var(--muted)" }}>Topilmadi.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Xavfli zayavkalar ro'yxati (har biri alohida; bosilsa faqat o'sha zayavka) ---
function RequestList({ requests, onOpen, advice = false }: { requests: RiskyRequest[]; onOpen: (r: RiskyRequest) => void; advice?: boolean }) {
  if (requests.length === 0) {
    return <div className="rounded-2xl p-10 text-center text-sm" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}>Xavfli zayavka topilmadi ✅</div>;
  }
  return (
    <div className="space-y-2">
      {advice && (
        <div className="rounded-xl px-4 py-2.5 text-xs flex items-center gap-2" style={{ background: "#2563eb14", border: "1px solid #2563eb33", color: "var(--text)" }}>
          🤖 <span><b>AI tavsiyasi:</b> quyidagi {requests.length} ta zayavka eng yuqori xavf ballida — chek/foto va narxni birinchi navbatda tekshiring.</span>
        </div>
      )}
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {requests.map((r) => {
        const meta = LEVEL_META[r.riskLevel];
        return (
          <button key={r.reqId} onClick={() => onOpen(r)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--surface-2)]"
            style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm" style={{ background: `${meta.color}1f`, color: meta.color }}>{meta.dot}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium tabular-nums">#{r.reqId}</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: `${meta.color}22`, color: meta.color }}>{meta.label}</span>
                <span className="text-xs truncate" style={{ color: "var(--muted)" }}>· {r.date} · {r.employee}</span>
              </div>
              <div className="text-xs mt-0.5 truncate" style={{ color: "var(--muted)" }}>{r.topReason}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-medium tabular-nums">{formatMoney(r.amount)}</div>
              <div className="text-[11px]" style={{ color: "var(--muted)" }}>{r.branch}</div>
            </div>
            <ChevronRight size={16} className="shrink-0" style={{ color: "var(--muted)" }} />
          </button>
        );
      })}
    </div>
    </div>
  );
}

// --- Lavozimning barcha xarajatlari (eye) — har qatorda 📄 zayavka tahlili ---
function ExpenseModal({ p, onOpenRequest, onClose }: { p: BudgetRow; onOpenRequest: (info: RequestRiskInfo) => void; onClose: () => void }) {
  const [onlyRisky, setOnlyRisky] = useState(false);
  const list = p.expenses.filter((e) => !onlyRisky || e.riskLevel !== "good");
  const riskyCount = p.expenses.filter((e) => e.riskLevel !== "good").length;

  const openRequest = (reqId: number) => {
    const items = p.expenses.filter((e) => e.reqId === reqId);
    const first = items[0];
    onOpenRequest({ reqId, hasReceipt: first?.hasReceipt ?? false, hasPhoto: first?.hasPhoto ?? false, items: items.map((e) => ({ name: e.name, category: e.category, amount: e.amount, supplier: e.supplier, findings: e.findings })) });
  };

  return (
    <>
      <div className="fixed inset-0 z-40 animate-fade" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div role="dialog" aria-modal="true" aria-label={`${p.label} xarajatlari`} onClick={(e) => e.stopPropagation()}
          className="w-full max-w-5xl rounded-2xl flex flex-col max-h-[85vh] animate-fade" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between gap-3 px-5 h-14 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
            <div className="min-w-0">
              <div className="font-semibold truncate">{p.label} — xarajatlar</div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>{p.expenses.length} ta xarid · {riskyCount} ta xavfli · jami {formatMoney(p.spent)}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setOnlyRisky((v) => !v)} aria-pressed={onlyRisky} className="px-3 py-1.5 rounded-xl text-xs font-medium transition" style={onlyRisky ? { background: "#f8717122", color: "#f87171", border: "1px solid #f8717155" } : { background: "var(--surface-2)", color: "var(--muted)" }}>Faqat xavfli</button>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2" aria-label="Yopish"><X size={18} /></button>
            </div>
          </div>
          <div className="overflow-auto p-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left sticky top-0" style={{ color: "var(--muted)", background: "var(--surface)" }}>
                  <th className="font-medium px-3 py-2 whitespace-nowrap">Sana</th>
                  <th className="font-medium px-3 py-2">Zayavka</th>
                  <th className="font-medium px-3 py-2">Mahsulot</th>
                  <th className="font-medium px-3 py-2 hidden md:table-cell">Kategoriya</th>
                  <th className="font-medium px-3 py-2 hidden lg:table-cell">Filial</th>
                  <th className="font-medium px-3 py-2 text-right">Summa</th>
                  <th className="font-medium px-3 py-2 hidden lg:table-cell">Ta&apos;minotchi</th>
                  <th className="font-medium px-3 py-2 text-center">Chek</th>
                  <th className="font-medium px-3 py-2 text-center">Foto</th>
                  <th className="font-medium px-3 py-2">Holat</th>
                  <th className="font-medium px-3 py-2 text-center">AI</th>
                </tr>
              </thead>
              <tbody>
                {list.map((e, i) => {
                  const meta = LEVEL_META[e.riskLevel];
                  const risky = e.riskLevel !== "good";
                  return (
                    <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums" style={{ color: "var(--muted)" }}>{e.date}</td>
                      <td className="px-3 py-2 tabular-nums">#{e.reqId}</td>
                      <td className="px-3 py-2 font-medium">{e.name}</td>
                      <td className="px-3 py-2 hidden md:table-cell" style={{ color: "var(--muted)" }}>{e.category ?? "—"}</td>
                      <td className="px-3 py-2 hidden lg:table-cell whitespace-nowrap">{e.branch}</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap font-medium">{formatMoney(e.amount)}</td>
                      <td className="px-3 py-2 hidden lg:table-cell">{e.supplier ?? "—"}</td>
                      <td className="px-3 py-2 text-center">{e.hasReceipt ? <Check size={14} className="inline" style={{ color: "#22c55e" }} /> : <Minus size={14} className="inline" style={{ color: "#f87171" }} />}</td>
                      <td className="px-3 py-2 text-center">{e.hasPhoto ? <Check size={14} className="inline" style={{ color: "#22c55e" }} /> : <Minus size={14} className="inline" style={{ color: "#f87171" }} />}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{risky ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium" style={{ background: `${meta.color}22`, color: meta.color }}>{meta.dot} {meta.label}</span> : <span style={{ color: "var(--muted)" }}>{e.statusLabel}</span>}</td>
                      <td className="px-3 py-2 text-center">{risky && <button onClick={() => openRequest(e.reqId)} className="p-1 rounded-lg hover:bg-surface-2 transition" title="AI tahlil" aria-label="AI tahlil"><FileText size={15} style={{ color: meta.color }} /></button>}</td>
                    </tr>
                  );
                })}
                {list.length === 0 && <tr><td colSpan={11} className="px-3 py-8 text-center" style={{ color: "var(--muted)" }}>{onlyRisky ? "Xavfli xarid yo'q ✅" : "Xarajat yo'q."}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
