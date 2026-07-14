import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { formatDate } from "@/lib/workflow";
import { currentMonth, isOpen, branchLabel } from "@/lib/helpers";
import { roleHasPerm } from "@/lib/perms";
import type { Profile } from "@/lib/types";
import { resolvePeriod, pctChange, dayKeysInRange, dayKey, type PeriodPreset } from "@/lib/finance";
import { buildAnomalies, type AItem } from "@/lib/anomalies";
import FinanceFilters from "./FinanceFilters";
import AnomalyPanel from "./AnomalyPanel";
import { saveThreshold, updateRates } from "./actions";
import LineChart from "@/components/charts/LineChart";
import Donut from "@/components/charts/Donut";
import ExportCsv from "@/components/ExportCsv";

// Dataviz validatsiyalangan dark palitra (kategoriya identifikatsiyasi — fixed order)
const CAT = ["#3987e5", "#199e70", "#c98500", "#9085e9", "#d95926", "#d55181", "#008300"];
const OTHER = "#898781";

type SP = { period?: string; type?: string; from?: string; to?: string };

// Moliya rolining BOSH SAHIFASI — to'liq financial dashboard. Yagona filter
// (davr + tur) butun sahifani boshqaradi. Faqat real Supabase ma'lumoti.
export default async function FinanceDashboard({ sp, profile }: { sp: SP; profile: Profile }) {
  const sb = await createClient();

  const preset = (sp.from || sp.to ? "custom" : sp.period || "30d") as PeriodPreset;
  const period = resolvePeriod(preset, sp.from, sp.to);
  const typeFilter = sp.type === "new_branch" || sp.type === "maintenance" ? sp.type : null;

  const [{ data: reqs }, { data: repCur }, { data: repPrev }, { data: items }, { data: branches }, { data: budgets }, { data: rates }, { data: thr }, { data: people }] = await Promise.all([
    sb.from("requests").select("id, type, status, estimated_amount, branch_id, paid, paid_at, deadline, created_at"),
    sb.from("reports").select("total, created_at, request:requests(type, branch_id)").gte("created_at", period.start).lt("created_at", period.end),
    sb.from("reports").select("total, created_at, request:requests(type, branch_id)").gte("created_at", period.prevStart).lt("created_at", period.prevEnd),
    sb.from("report_items").select("name, category, supplier, qty, price, report:reports(created_at, submitted_by, request:requests(type, branch_id, status))"),
    sb.from("branches").select("id, name"),
    sb.from("budgets").select("branch_id, category, amount").eq("month", currentMonth()),
    sb.from("exchange_rates").select("currency, rate, updated_at"),
    sb.from("org_settings").select("value").eq("key", "ceo_threshold").maybeSingle(),
    sb.from("profiles").select("id, full_name"),
  ]);
  const profileName = new Map(((people ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]));
  const rateList = ((rates ?? []) as { currency: string; rate: number; updated_at: string }[]);
  const ceoThreshold = thr?.value ?? "50000000";
  const canSetThreshold = await roleHasPerm(sb, profile.org_id, profile.role, "manage_ceo_threshold");

  const branchName = new Map((branches ?? []).map((b) => [b.id, branchLabel(b.name)]));
  const matchesType = (t: string | null | undefined) => !typeFilter || t === typeFilter;

  // ---- Reports -> kunlik dinamika + filial + jami (davr + oldingi) ----
  type Rep = { total: number; created_at: string; request: { type: string | null; branch_id: number | null } | null };
  const cur = ((repCur ?? []) as unknown as Rep[]).filter((r) => matchesType(r.request?.type));
  const prev = ((repPrev ?? []) as unknown as Rep[]).filter((r) => matchesType(r.request?.type));
  const sum = (a: Rep[]) => a.reduce((s, r) => s + (r.total || 0), 0);
  const totalCur = sum(cur), totalPrev = sum(prev);

  const byDayCur = new Map<string, number>();
  for (const r of cur) byDayCur.set(dayKey(r.created_at), (byDayCur.get(dayKey(r.created_at)) ?? 0) + (r.total || 0));
  const byDayPrev = new Map<string, number>();
  for (const r of prev) byDayPrev.set(dayKey(r.created_at), (byDayPrev.get(dayKey(r.created_at)) ?? 0) + (r.total || 0));
  const curKeys = dayKeysInRange(period.start, period.end);
  const prevKeys = dayKeysInRange(period.prevStart, period.prevEnd);
  const dyn = curKeys.map((k, i) => ({
    label: formatDate(k), current: byDayCur.get(k) ?? 0, previous: byDayPrev.get(prevKeys[i]) ?? 0,
  }));

  const brCur = new Map<number, number>(), brPrev = new Map<number, number>();
  for (const r of cur) if (r.request?.branch_id) brCur.set(r.request.branch_id, (brCur.get(r.request.branch_id) ?? 0) + (r.total || 0));
  for (const r of prev) if (r.request?.branch_id) brPrev.set(r.request.branch_id, (brPrev.get(r.request.branch_id) ?? 0) + (r.total || 0));
  const branchRows = [...brCur.entries()].map(([id, val]) => ({ name: branchName.get(id) ?? `#${id}`, val, prev: brPrev.get(id) ?? 0 }))
    .sort((a, b) => b.val - a.val).slice(0, 10);
  const brMax = Math.max(1, ...branchRows.map((b) => b.val));

  // ---- report_items -> kategoriya (davr + oldingi) + anomaliyalar ----
  type DItem = { name: string; category: string | null; supplier: string | null; qty: number; price: number; report: { created_at: string; submitted_by: string | null; request: { type: string | null; branch_id: number | null; status: string } | null } | null };
  const allItems = (items ?? []) as unknown as DItem[];
  const inRange = (iso: string, s: string, e: string) => iso >= s && iso < e;
  const itemVal = (it: DItem) => (Number(it.qty) || 0) * (Number(it.price) || 0);
  const curItems = allItems.filter((it) => it.report && matchesType(it.report.request?.type) && inRange(it.report.created_at, period.start, period.end));
  const prevItems = allItems.filter((it) => it.report && matchesType(it.report.request?.type) && inRange(it.report.created_at, period.prevStart, period.prevEnd));

  const catCur = new Map<string, number>(), catPrev = new Map<string, number>();
  for (const it of curItems) if (it.category) catCur.set(it.category, (catCur.get(it.category) ?? 0) + itemVal(it));
  for (const it of prevItems) if (it.category) catPrev.set(it.category, (catPrev.get(it.category) ?? 0) + itemVal(it));
  const catSorted = [...catCur.entries()].sort((a, b) => b[1] - a[1]);
  const catTop = catSorted.slice(0, 7);
  const catOtherVal = catSorted.slice(7).reduce((s, [, v]) => s + v, 0);
  const categorySlices = [
    ...catTop.map(([label, value], i) => ({ label, value, prev: catPrev.get(label) ?? 0, color: CAT[i % CAT.length] })),
    ...(catOtherVal > 0 ? [{ label: "Boshqalar", value: catOtherVal, color: OTHER }] : []),
  ];

  // ---- KPI uchun zayavkalar ----
  const allReqs = (reqs ?? []) as { id: number; type: string; status: string; estimated_amount: number | null; branch_id: number | null; paid: boolean | null; deadline: string | null; paid_at: string | null; created_at: string }[];
  const now = new Date();

  const pend = allReqs.filter((r) => matchesType(r.type) && ["pending_axo", "pending_ceo", "pending_finance"].includes(r.status));
  const todayK = now.toISOString().slice(0, 10);
  const paidToday = allReqs.filter((r) => matchesType(r.type) && r.paid && r.paid_at?.slice(0, 10) === todayK);
  const overdue = allReqs.filter((r) => matchesType(r.type) && isOpen(r.status) && r.deadline && new Date(r.deadline) < now);
  // Byudjetdan oshgan filiallar (joriy oy)
  const budgetByBranch = new Map<number, number>();
  for (const b of budgets ?? []) if ((b.category ?? "") === "") budgetByBranch.set(b.branch_id, Number(b.amount));
  let overBudgetCount = 0;
  for (const [bid, bud] of budgetByBranch) if (bud > 0 && (brCur.get(bid) ?? 0) > bud) overBudgetCount++;

  const kpis: { icon: string; label: string; value: string; sub: string; tone: "good" | "warning" | "serious" | "critical"; grad?: string }[] = [
    { icon: "⏳", label: "Tasdiqlanishi kutilmoqda", value: formatMoney(pend.reduce((s, r) => s + Number(r.estimated_amount ?? 0), 0)), sub: `${pend.length} ta zayavka`, tone: "warning" },
    { icon: "✓", label: "Bugun to'langan", value: formatMoney(paidToday.reduce((s, r) => s + Number(r.estimated_amount ?? 0), 0)), sub: `${paidToday.length} ta to'lov`, tone: "good" },
    { icon: "⏰", label: "Kechikkan to'lovlar", value: formatMoney(overdue.reduce((s, r) => s + Number(r.estimated_amount ?? 0), 0)), sub: `${overdue.length} ta muddati o'tgan`, tone: "serious" },
    { icon: "⚠", label: "Byudjetdan oshgan", value: String(overBudgetCount), sub: "filial", tone: "critical" },
  ];
  const totalDelta = pctChange(totalCur, totalPrev);

  // ---- To'lov holati (davr + oldingi) — real: paid / kechikkan / kutilmoqda ----
  const payBuckets = (rs: typeof allReqs) => {
    let paid = 0, waiting = 0, late = 0;
    for (const r of rs) {
      const amt = Number(r.estimated_amount ?? 0);
      if (r.paid) paid += amt;
      else if (isOpen(r.status) && r.deadline && new Date(r.deadline) < now) late += amt;
      else waiting += amt;
    }
    return { paid, waiting, late };
  };
  const stCur = payBuckets(allReqs.filter((r) => matchesType(r.type) && inRange(r.created_at, period.start, period.end)));
  const stPrev = payBuckets(allReqs.filter((r) => matchesType(r.type) && inRange(r.created_at, period.prevStart, period.prevEnd)));
  const statusSlices = [
    { label: "To'langan", value: stCur.paid, prev: stPrev.paid, color: "#199e70" },
    { label: "Kutilmoqda", value: stCur.waiting, prev: stPrev.waiting, color: "#c98500" },
    { label: "Kechikkan", value: stCur.late, prev: stPrev.late, color: "#d03b3b" },
  ].filter((s) => s.value > 0 || s.prev > 0);

  // ---- Anomaliyalar (real ma'lumotdan, AI tahlil) — "kim oldi" biriktiriladi ----
  const enriched: AItem[] = allItems.map((it) => ({
    name: it.name, category: it.category, supplier: it.supplier, qty: it.qty, price: it.price,
    who: it.report?.submitted_by ? profileName.get(it.report.submitted_by) ?? null : null,
    report: it.report ? { created_at: it.report.created_at, request: it.report.request } : null,
  }));
  const anomalies = buildAnomalies(enriched, branchName, budgetByBranch, brCur, catCur, catPrev, totalCur, totalPrev);

  // AI Risk + Limitlar KPI kartalari (gradientli)
  const criticalCount = anomalies.filter((a) => a.sev === "critical").length;
  kpis.push(
    { icon: "🤖", label: "AI Risk — bugungi xavf", value: String(anomalies.length), sub: `${criticalCount} kritik holat`, tone: "critical", grad: "linear-gradient(135deg,#e0713a,#e5534b)" },
    { icon: "🛡", label: "Limitlar", value: String(overBudgetCount), sub: overBudgetCount ? "ogohlantirish" : "normal", tone: "warning", grad: "linear-gradient(135deg,#d29922,#e0a83a)" },
  );

  // ---- So'nggi xarajatlar ----
  const recent = [...curItems].sort((a, b) => (b.report!.created_at > a.report!.created_at ? 1 : -1)).slice(0, 8);

  return (
    <div className="space-y-5">
      {/* Minimal header + filter bir qatorda — vertikal joyni tejaydi (above-the-fold) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight truncate">Salom, {profile.full_name.split(" ")[0] || profile.full_name}!</h1>
          <p className="text-xs" style={{ color: "var(--muted)" }}>Moliyaviy holat — {period.label.toLowerCase()}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ExportCsv filename={`moliya-${preset}`} headers={["Sana", "Joriy", "Oldingi"]} rows={dyn.map((d) => [d.label, d.current, d.previous])} label="⤓ Export" />
          <Link href="/requests/new" className="btn btn-brand !py-1.5 text-sm">+ Yangi zayavka</Link>
        </div>
      </div>

      <FinanceFilters />

      {/* KPI — ixcham (birinchi ekranga sig'sin) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map((k) => {
          const grad = k.grad;
          return (
            <div key={k.label} className="relative rounded-2xl p-4 overflow-hidden" style={grad ? { background: grad, border: "1px solid transparent" } : { background: "var(--surface)", border: "1px solid var(--border)" }}>
              {!grad && <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: toneColor(k.tone) }} />}
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: grad ? "rgba(255,255,255,0.2)" : "var(--surface-2)" }}>{k.icon}</div>
                {!grad && <span className="w-2.5 h-2.5 rounded-full" style={{ background: toneColor(k.tone), boxShadow: `0 0 0 4px ${toneColor(k.tone)}22` }} />}
              </div>
              <div className="mt-3 text-xl xl:text-2xl font-bold tracking-tight tabular-nums truncate" style={grad ? { color: "#fff" } : undefined}>{k.value}</div>
              <div className="mt-0.5 text-xs truncate" style={{ color: grad ? "rgba(255,255,255,0.9)" : "var(--muted)" }}>{k.label}</div>
              <div className="text-[11px] truncate" style={{ color: grad ? "rgba(255,255,255,0.75)" : "var(--muted)" }}>{k.sub}</div>
            </div>
          );
        })}
      </div>

      {/* DINAMIKA (hero — deyarli to'liq en, birinchi ekranga moslangan balandlik) */}
      <section className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="font-semibold">Xarajatlar dinamikasi</h2>
            <div className="text-xs mt-0.5 flex items-center gap-3" style={{ color: "var(--muted)" }}>
              <span>Jami: <b style={{ color: "var(--text)" }}>{formatMoney(totalCur)}</b></span>
              {totalDelta != null && <span style={{ color: totalDelta > 0 ? "#e66767" : "#0ca30c" }}>{totalDelta > 0 ? "▲ +" : "▼ "}{Math.abs(totalDelta)}% oldingi davrga</span>}
            </div>
          </div>
          <Legend items={[["#3987e5", "Joriy davr"], ["var(--muted)", "Oldingi davr"]]} />
        </div>
        <div className="h-[clamp(240px,38vh,360px)]">
          <LineChart data={dyn} height="100%" />
        </div>
      </section>

      {/* FILIALLAR (to'liq en — 10 ta filial sig'adi) */}
      <section className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h2 className="font-semibold mb-4">Filiallar bo&apos;yicha xarajat</h2>
        {branchRows.length === 0 ? <Empty /> : (
          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-x-10 gap-y-3">
            {branchRows.map((b) => {
              const d = pctChange(b.val, b.prev);
              const dAmt = b.val - b.prev;
              const up = dAmt > 0;
              const col = d == null ? "var(--muted)" : up ? "#e66767" : "#0ca30c";
              return (
                <div key={b.name} className="flex items-center gap-4">
                  <div className="w-32 shrink-0 text-sm truncate" title={b.name}>{b.name}</div>
                  <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.max(2, (b.val / brMax) * 100)}%`, background: "#3987e5" }} />
                  </div>
                  <div className="w-32 text-right text-sm tabular-nums font-medium">{formatMoney(b.val)}</div>
                  <div className="w-28 text-right shrink-0">
                    <div className="text-xs tabular-nums font-medium" style={{ color: col }}>{d == null ? "—" : `${up ? "▲" : "▼"} ${Math.abs(d)}%`}</div>
                    <div className="text-[11px] tabular-nums" style={{ color: "var(--muted)" }}>{up ? "+" : ""}{formatMoney(dAmt)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* KATEGORIYA + TO'LOV HOLATI (donutlar) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h2 className="font-semibold mb-4">Xarajat kategoriyalari</h2>
          <Donut data={categorySlices} />
        </section>
        <section className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h2 className="font-semibold mb-4">To&apos;lov holati</h2>
          <Donut data={statusSlices} />
        </section>
      </div>

      {/* DIQQAT TALAB QILADI (AI tahlil — kartani bosganda drawer ochiladi) */}
      <AnomalyPanel anomalies={anomalies} />

      {/* SO'NGGI XARAJATLAR */}
      <section className="rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h2 className="font-semibold mb-4">So&apos;nggi xarajatlar</h2>
        {recent.length === 0 ? <Empty /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-x-10">
            {recent.map((it, i) => (
              <div key={i} className="flex items-center gap-3 text-sm py-2.5 border-t" style={{ borderColor: "var(--border)" }}>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{it.name}</div>
                  <div className="text-xs truncate" style={{ color: "var(--muted)" }}>
                    {it.category ?? "—"}{it.report?.request?.branch_id ? ` · ${branchName.get(it.report.request.branch_id) ?? ""}` : ""}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="tabular-nums font-medium">{formatMoney(itemVal(it))}</div>
                  <div className="text-[11px]" style={{ color: "var(--muted)" }}>{formatDate(it.report!.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Footer: valyuta kurslari + CEO chegarasi (mavjud funksiyalar saqlanadi) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Valyuta kurslari (CBU)</h3>
            <form action={updateRates}><button className="text-xs" style={{ color: "var(--brand)" }}>🔄 Yangilash</button></form>
          </div>
          {rateList.length === 0 ? <p className="text-xs" style={{ color: "var(--muted)" }}>Kurslar yuklanmagan — «Yangilash».</p> : (
            <div className="flex flex-wrap gap-4 text-sm">
              {rateList.map((r) => <span key={r.currency}><b>1 {r.currency}</b> = {formatMoney(r.rate)}</span>)}
            </div>
          )}
        </div>
        {canSetThreshold && (
          <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <h3 className="text-sm font-semibold mb-2">CEO tasdig&apos;i chegarasi</h3>
            <form action={saveThreshold} className="flex items-end gap-2">
              <input name="ceo_threshold" type="number" defaultValue={ceoThreshold} className="text-sm px-3 py-1.5 rounded-xl outline-none w-44"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }} />
              <span className="text-sm" style={{ color: "var(--muted)" }}>so&apos;m</span>
              <button className="btn btn-brand !py-1.5 text-sm">Saqlash</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- presentatsion helperlar ----------------
function toneColor(t: "good" | "warning" | "serious" | "critical") {
  return { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b" }[t];
}
function Legend({ items }: { items: [string, string][] }) {
  return (
    <div className="flex items-center gap-3 text-xs" style={{ color: "var(--muted)" }}>
      {items.map(([c, l]) => <span key={l} className="flex items-center gap-1.5"><span className="w-3 h-[2px] rounded" style={{ background: c }} />{l}</span>)}
    </div>
  );
}
function Empty({ text = "Bu davr uchun ma'lumot yo'q." }: { text?: string }) {
  return <div className="text-center py-8 text-sm" style={{ color: "var(--muted)" }}>{text}</div>;
}
