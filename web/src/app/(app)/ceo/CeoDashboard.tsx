"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, ArrowDownRight, ChevronLeft, TrendingUp, TrendingDown } from "lucide-react";
import { formatNumber } from "@/lib/format";
import ExportCsv from "@/components/ExportCsv";

// =============================================================================
// CEO Dashboard — premium Overview (default) + in-page Finance Detail (Detalniy).
// CEO 5 soniyada tushunadi: katta raqam · trend · top 5 · donut · progress.
// Faqat UI: barcha ma'lumot serverdan (Supabase). Route/logika o'zgarmaydi.
// =============================================================================

export interface CeoBig { key: string; icon: string; label: string; value: number; sub: string; trend: number; grad: string; }
export interface BranchRow { name: string; amount: number; pct: number; trend: number; }
export interface Block { total: number; rows: BranchRow[]; donutColor: string; }
export interface BottomKpi { label: string; value: string; icon: string; tone: string; }
export interface CeoData {
  month: string; dateLabel: string;
  big: CeoBig[]; newBlock: Block; runBlock: Block; bottom: BottomKpi[];
  detail: {
    constructionTable: BranchRow[]; runningTable: BranchRow[];
    dynamics: { label: string; value: number }[];
    categoryPie: { label: string; value: number; pct: number; color: string }[];
    totalSpent: number; totalBudget: number; newTotal: number; runTotal: number; saved: number;
    branches: { id: number; name: string }[]; categories: string[];
  };
}

const som = (n: number) => `${formatNumber(n)} so'm`;
const mlrd = (n: number) => `${(n / 1e9).toFixed(2)}`;
const DONUT = ["#3987e5", "#c98500", "#9085e9", "#008300", "#e66767", "#06b6d4"];

export default function CeoDashboard({ data }: { data: CeoData }) {
  const [view, setView] = useState<"overview" | "detail">("overview");
  if (view === "detail") return <Detail data={data} onBack={() => setView("overview")} />;

  return (
    <div className="space-y-8 animate-fade">
      {/* Header — toza, katta */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CEO Dashboard</h1>
          <p className="text-base mt-1.5" style={{ color: "var(--muted)" }}>Kompaniya moliyaviy holati bir qarashda</p>
        </div>
        <span className="text-sm font-medium px-4 py-2 rounded-2xl" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>{data.dateLabel}</span>
      </div>

      {/* 1-QATOR — 4 ta juda katta KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {data.big.map((k) => (
          <div key={k.key}
            className="group relative overflow-hidden rounded-[28px] p-7 text-white transition-all duration-300 hover:scale-[1.02]"
            style={{ background: k.grad, boxShadow: "0 20px 48px -20px rgba(0,0,0,.6)", border: "1px solid rgba(255,255,255,.08)", minHeight: 200 }}>
            {/* Glass highlight */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(160deg, rgba(255,255,255,.14), rgba(255,255,255,0) 45%)" }} />
            <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full opacity-15 transition-transform duration-500 group-hover:scale-125" style={{ background: "#fff" }} />
            <div className="relative flex items-center justify-between">
              <span className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl backdrop-blur-sm" style={{ background: "rgba(255,255,255,.2)" }}>{k.icon}</span>
              {k.trend !== 0 && (
                <span className="text-[13px] font-semibold flex items-center gap-0.5 px-2.5 py-1 rounded-xl backdrop-blur-sm" style={{ background: "rgba(255,255,255,.2)" }}>
                  {k.trend > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{Math.abs(k.trend)}%
                </span>
              )}
            </div>
            <div className="relative mt-7">
              <div className="text-[26px] sm:text-[30px] xl:text-[34px] font-extrabold leading-none tracking-tight tabular-nums break-words">{formatNumber(k.value)}</div>
              <div className="text-sm font-medium text-white/75 mt-2">so&apos;m</div>
            </div>
            <div className="relative mt-4">
              <div className="text-sm font-semibold">{k.label}</div>
              <div className="text-xs text-white/70 mt-0.5">{k.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 2-QATOR — 2 ta katta blok */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <BlockCard title="Qurilish (yangi filiallar) bo'yicha xarajatlar" block={data.newBlock} onDetail={() => setView("detail")} />
        <BlockCard title="Ishlab turgan filiallar bo'yicha xarajatlar" block={data.runBlock} onDetail={() => setView("detail")} />
      </div>

      {/* PASTKI QATOR — 6 ta kichik KPI (bitta qator) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {data.bottom.map((k) => (
          <div key={k.label} className="rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 8px 24px -18px rgba(0,0,0,.5)" }}>
            <span className="w-9 h-9 rounded-xl flex items-center justify-center text-base" style={{ background: `${k.tone}1f` }}>{k.icon}</span>
            <div className="text-2xl font-bold mt-3 tabular-nums leading-none" style={{ color: k.tone }}>{k.value}</div>
            <div className="text-xs mt-2" style={{ color: "var(--muted)" }}>{k.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Katta blok (top 5 + progress + donut + Detalniy) ──
function BlockCard({ title, block, onDetail }: { title: string; block: Block; onDetail: () => void }) {
  const top = block.rows.slice(0, 5);
  const rest = block.rows.slice(5).reduce((s, r) => s + r.amount, 0);
  const segs = top.map((r, i) => ({ name: r.name, amount: r.amount, color: DONUT[i % DONUT.length] }));
  if (rest > 0) segs.push({ name: "Boshqa", amount: rest, color: "#64748b" });
  const maxAmt = Math.max(1, ...top.map((r) => r.amount));

  return (
    <div className="rounded-[28px] p-7" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 16px 40px -24px rgba(0,0,0,.5)" }}>
      <div className="flex items-start justify-between gap-3 mb-6">
        <h2 className="text-base font-semibold tracking-tight leading-snug pr-2">{title}</h2>
        <button onClick={onDetail} className="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-2xl transition-all hover:scale-[1.03]"
          style={{ background: "var(--brand)", color: "var(--brand-fg)", boxShadow: "0 8px 20px -8px rgba(37,99,235,.6)" }}>Detalniy <ArrowUpRight size={14} /></button>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-7">
        <div className="flex-1 w-full space-y-4 order-2 sm:order-1">
          {top.length === 0 ? <div className="text-sm text-center py-8" style={{ color: "var(--muted)" }}>Ma&apos;lumot yo&apos;q.</div> : top.map((r, i) => (
            <div key={r.name}>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="flex items-center gap-2.5 min-w-0"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: DONUT[i % DONUT.length] }} /><span className="truncate font-medium">{r.name}</span></span>
                <span className="flex items-center gap-2.5 shrink-0"><span className="font-bold tabular-nums">{mlrd(r.amount)} <span className="text-[11px] font-medium" style={{ color: "var(--muted)" }}>mlrd</span></span><span className="text-xs w-10 text-right" style={{ color: "var(--muted)" }}>{r.pct}%</span></span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                <div className="h-full rounded-full" style={{ width: `${Math.max((r.amount / maxAmt) * 100, 6)}%`, background: `linear-gradient(90deg, ${DONUT[i % DONUT.length]}, ${DONUT[i % DONUT.length]}bb)`, transition: "width .7s cubic-bezier(.16,1,.3,1)" }} />
              </div>
            </div>
          ))}
        </div>
        <Donut segs={segs} total={block.total} big />
      </div>
    </div>
  );
}

// ── Donut ──
function Donut({ segs, total, big = false }: { segs: { name: string; amount: number; color: string }[]; total: number; big?: boolean }) {
  let acc = 0;
  const arcs = segs.map((s) => { const frac = total ? s.amount / total : 0; const a = { color: s.color, len: frac * 100, offset: 25 - acc }; acc += frac * 100; return a; });
  const size = big ? "w-44 h-44" : "w-36 h-36";
  return (
    <div className={`relative shrink-0 ${big ? "order-1 sm:order-2" : ""}`}>
      <svg viewBox="0 0 42 42" className={`${size} -rotate-90`}>
        <circle cx="21" cy="21" r="15.915" fill="none" stroke="var(--surface-2)" strokeWidth={big ? 3.5 : 4} />
        {total > 0 && arcs.map((s, i) => s.len > 0 && <circle key={i} cx="21" cy="21" r="15.915" fill="none" stroke={s.color} strokeWidth={big ? 3.5 : 4} strokeDasharray={`${s.len} ${100 - s.len}`} strokeDashoffset={s.offset} strokeLinecap="round" style={{ transition: "stroke-dasharray .7s cubic-bezier(.16,1,.3,1)" }} />)}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-extrabold leading-none tabular-nums ${big ? "text-3xl" : "text-xl"}`}>{mlrd(total)}</span>
        <span className="text-[11px] mt-1 font-medium tracking-wide" style={{ color: "var(--muted)" }}>MLRD so&apos;m</span>
      </div>
    </div>
  );
}

// ── DETALNIY (Finance detail — jadval / filtr / export / grafik / kategoriya) ──
function Detail({ data, onBack }: { data: CeoData; onBack: () => void }) {
  const d = data.detail;
  const [branch, setBranch] = useState("all");
  const [cat, setCat] = useState("all");
  const filterRows = (rows: BranchRow[]) => (branch === "all" ? rows : rows.filter((r) => r.name === branch));
  const cRows = filterRows(d.constructionTable), rRows = filterRows(d.runningTable);
  const exportRows = useMemo(() => [...cRows.map((r) => ["Qurilish", r.name, r.amount, `${r.pct}%`]), ...rRows.map((r) => ["Ishlab turgan", r.name, r.amount, `${r.pct}%`])], [cRows, rRows]);

  return (
    <div className="space-y-6 animate-fade">
      <div>
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-medium mb-2 transition hover:opacity-80" style={{ color: "var(--muted)" }}>
          <ChevronLeft size={14} /> CEO Dashboard <span className="opacity-40">/</span> <span style={{ color: "var(--text)" }}>Detalniy</span>
        </button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h1 className="text-2xl font-bold tracking-tight">Moliyaviy detalniy</h1><p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>To&apos;liq analitik ko&apos;rinish · {data.dateLabel}</p></div>
          <ExportCsv filename={`ceo-detalniy-${data.month}`} headers={["Tur", "Filial", "Xarajat", "Ulush"]} rows={exportRows} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 p-3 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <Select value={branch} onChange={setBranch} options={[["all", "Barcha filiallar"], ...d.branches.map((b) => [b.name, b.name] as [string, string])]} />
        <Select value={cat} onChange={setCat} options={[["all", "Barcha kategoriyalar"], ...d.categories.map((c) => [c, c] as [string, string])]} />
        <Select value="all" onChange={() => {}} options={[["all", "Barcha to'lov turlari"], ["cash", "Naqd"], ["bank", "Bank"]]} />
        <Select value="month" onChange={() => {}} options={[["month", "Joriy oy"], ["quarter", "Chorak"], ["year", "Yil"]]} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[["Jami xarajat", d.totalSpent, "#3b82f6"], ["Qurilish", d.newTotal, "#22c55e"], ["Ishlab turgan", d.runTotal, "#a855f7"], ["Tejalgan", d.saved, "#f59e0b"]].map(([l, v, c]) => (
          <div key={l as string} className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>{l as string}</div>
            <div className="text-lg font-bold mt-1 tabular-nums truncate" style={{ color: c as string }}>{som(v as number)}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <FinTable title="Qurilish filiallari" rows={cRows} />
        <FinTable title="Ishlab turgan filiallar" rows={rRows} />
        <div className="space-y-4">
          <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <h3 className="text-sm font-semibold mb-3">Xarajat dinamikasi</h3>
            <LineChart points={d.dynamics} />
          </div>
          <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <h3 className="text-sm font-semibold mb-3">Kategoriya bo&apos;yicha</h3>
            <div className="flex items-center gap-4">
              <Donut segs={d.categoryPie.map((c) => ({ name: c.label, amount: c.value, color: c.color }))} total={d.categoryPie.reduce((s, c) => s + c.value, 0)} />
              <div className="flex-1 space-y-1.5">
                {d.categoryPie.map((c) => (
                  <div key={c.label} className="flex items-center gap-2 text-[12px]" style={{ opacity: cat === "all" || cat === c.label ? 1 : 0.4 }}>
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: c.color }} />
                    <span className="flex-1 truncate">{c.label}</span>
                    <span className="font-semibold tabular-nums" style={{ color: "var(--muted)" }}>{c.pct}%</span>
                  </div>
                ))}
                {d.categoryPie.length === 0 && <div className="text-xs" style={{ color: "var(--muted)" }}>Ma&apos;lumot yo&apos;q.</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FinTable({ title, rows }: { title: string; rows: BranchRow[] }) {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <h3 className="text-sm font-semibold px-4 pt-4 pb-3">{title}</h3>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}><th className="font-medium px-4 pb-2">Filial</th><th className="font-medium pb-2 text-right">Xarajat</th><th className="font-medium pb-2 text-right pr-2">%</th><th className="font-medium pb-2 text-right pr-4">Trend</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t" style={{ borderColor: "var(--border)" }}>
              <td className="px-4 py-2.5 font-medium truncate max-w-[120px]">{r.name}</td>
              <td className="py-2.5 text-right tabular-nums">{formatNumber(r.amount)}</td>
              <td className="py-2.5 text-right pr-2 tabular-nums" style={{ color: "var(--muted)" }}>{r.pct}%</td>
              <td className="py-2.5 text-right pr-4"><span className="inline-flex items-center gap-0.5 text-[11px] font-medium" style={{ color: r.trend > 0 ? "#ef4444" : "#22c55e" }}>{r.trend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{Math.abs(r.trend)}%</span></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-sm" style={{ color: "var(--muted)" }}>Ma&apos;lumot yo&apos;q.</td></tr>}
          {rows.length > 0 && <tr className="border-t" style={{ borderColor: "var(--border)" }}><td className="px-4 py-2.5 font-semibold">Jami</td><td className="py-2.5 text-right font-bold tabular-nums">{formatNumber(total)}</td><td colSpan={2} className="py-2.5 text-right pr-4 text-[11px]" style={{ color: "var(--muted)" }}>100%</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function LineChart({ points }: { points: { label: string; value: number }[] }) {
  const W = 300, H = 120, PAD = 6;
  const max = Math.max(1, ...points.map((p) => p.value));
  const n = points.length;
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / Math.max(1, n - 1);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.value)}`).join(" ");
  const area = `${line} L ${x(n - 1)} ${H - PAD} L ${x(0)} ${H - PAD} Z`;
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
        <defs><linearGradient id="ceoDyn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity="0.28" /><stop offset="100%" stopColor="#2563eb" stopOpacity="0" /></linearGradient></defs>
        {[0.33, 0.66].map((gg) => <line key={gg} x1={PAD} x2={W - PAD} y1={PAD + gg * (H - PAD * 2)} y2={PAD + gg * (H - PAD * 2)} stroke="var(--border)" strokeWidth="1" opacity="0.5" />)}
        <path d={area} fill="url(#ceoDyn)" />
        <path d={line} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="flex justify-between text-[10px] mt-1" style={{ color: "var(--muted)" }}><span>{points[0]?.label}</span><span>{points[Math.floor(n / 2)]?.label}</span><span>{points[n - 1]?.label}</span></div>
      <div className="text-[10px] mt-1" style={{ color: "var(--muted)" }}>mln so&apos;m / kun</div>
    </>
  );
}

function Select({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="text-sm px-3 py-2 rounded-xl outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
