import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toSom, type Rates } from "@/lib/currency";
import { CEO_ROLES } from "@/lib/constants";
import { isOpen, currentMonth, monthRange, branchLabel } from "@/lib/helpers";
import CeoDashboard, { type CeoData } from "./CeoDashboard";

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
const UZ_MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
const trendPct = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? 100 : 0);

export default async function CeoPage() {
  const profile = await requireProfile();
  if (!CEO_ROLES.includes(profile.role)) redirect("/");
  return <CeoView />;
}

// Qayta ishlatiladigan CEO ko'rinishi — /ceo va bosh sahifa (CEO rollari) uchun.
export async function CeoView() {
  const sb = await createClient();
  const now = new Date();
  const month = currentMonth();
  const mr = monthRange(month);
  const [py, pm] = month.split("-").map(Number);
  const prevMonth = pm === 1 ? `${py - 1}-12` : `${py}-${String(pm - 1).padStart(2, "0")}`;
  const pmr = monthRange(prevMonth);

  const [{ data: reqs }, { data: reports }, { data: prevReports }, { data: items }, { data: budgets }, { data: branches }, { data: rateRows }] = await Promise.all([
    sb.from("requests").select("id, title, type, status, estimated_amount, estimated_currency, branch_id, paid"),
    sb.from("reports").select("total, created_at, request:requests(branch_id, type)").gte("created_at", mr.start).lt("created_at", mr.end),
    sb.from("reports").select("total, request:requests(branch_id, type)").gte("created_at", pmr.start).lt("created_at", pmr.end),
    sb.from("report_items").select("category, qty, price, report:reports(created_at)"),
    sb.from("budgets").select("branch_id, category, amount").eq("month", month),
    sb.from("branches").select("id, name, status"),
    sb.from("exchange_rates").select("currency, rate"),
  ]);

  const rates: Rates = {};
  for (const r of rateRows ?? []) rates[(r as { currency: string }).currency] = (r as { rate: number }).rate;
  const branchInfo = new Map((branches ?? []).map((b) => [b.id, { name: branchLabel(b.name), status: b.status as string }]));

  const all = (reqs ?? []) as { id: number; title: string; type: string; status: string; estimated_amount: number | null; estimated_currency: string | null; branch_id: number | null; paid: boolean | null }[];
  const plannedSom = (r: { estimated_amount: number | null; estimated_currency: string | null }) => toSom(Number(r.estimated_amount ?? 0), r.estimated_currency, rates);

  // --- Xarajat: tur bo'yicha (qurilish = new_branch, ishlab turgan = maintenance) ---
  type Rep = { total: number; created_at?: string; request: { branch_id: number | null; type: string } | null };
  let totalSpent = 0, newTotal = 0, runTotal = 0;
  const newByBranch = new Map<number, number>(), runByBranch = new Map<number, number>();
  const daily = new Map<string, number>();
  for (const r of (reports ?? []) as unknown as Rep[]) {
    const t = r.total || 0; totalSpent += t;
    const type = r.request?.type, bid = r.request?.branch_id;
    if (type === "new_branch") { newTotal += t; if (bid) newByBranch.set(bid, (newByBranch.get(bid) ?? 0) + t); }
    else { runTotal += t; if (bid) runByBranch.set(bid, (runByBranch.get(bid) ?? 0) + t); }
    if (r.created_at) { const d = r.created_at.slice(0, 10); daily.set(d, (daily.get(d) ?? 0) + t); }
  }
  let prevTotal = 0, prevNew = 0, prevRun = 0;
  const prevNewByBranch = new Map<number, number>(), prevRunByBranch = new Map<number, number>();
  for (const r of (prevReports ?? []) as unknown as Rep[]) {
    const t = r.total || 0; prevTotal += t;
    if (r.request?.type === "new_branch") { prevNew += t; if (r.request.branch_id) prevNewByBranch.set(r.request.branch_id, (prevNewByBranch.get(r.request.branch_id) ?? 0) + t); }
    else { prevRun += t; if (r.request?.branch_id) prevRunByBranch.set(r.request.branch_id, (prevRunByBranch.get(r.request.branch_id) ?? 0) + t); }
  }

  // --- Byudjet / tejalgan ---
  const budgetByBranch = new Map<number, number>();
  for (const b of budgets ?? []) { const bb = b as { branch_id: number; category: string | null; amount: number }; if ((bb.category ?? "") === "") budgetByBranch.set(bb.branch_id, Number(bb.amount)); }
  let totalBudget = 0; for (const v of budgetByBranch.values()) totalBudget += v;
  const saved = Math.max(0, totalBudget - totalSpent);
  const budgetPct = totalBudget ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const committed = all.filter((r) => isOpen(r.status) && ["approved", "funded", "manager_doing", "axo_review"].includes(r.status)).reduce((s, r) => s + plannedSom(r), 0);

  // --- Bloklar uchun top filiallar ---
  const buildRows = (m: Map<number, number>, prev: Map<number, number>, total: number) =>
    [...m.entries()].map(([id, amount]) => ({ name: branchInfo.get(id)?.name ?? `#${id}`, amount, pct: total ? Math.round((amount / total) * 100) : 0, trend: trendPct(amount, prev.get(id) ?? 0) }))
      .sort((a, b) => b.amount - a.amount);
  const newRows = buildRows(newByBranch, prevNewByBranch, newTotal);
  const runRows = buildRows(runByBranch, prevRunByBranch, runTotal);

  // --- Kategoriya bo'yicha (pie, Detalniy) ---
  const catMap = new Map<string, number>();
  for (const it of items ?? []) {
    const ii = it as unknown as { category: string | null; qty: number | null; price: number | null; report: { created_at: string } | null };
    if (!ii.report?.created_at?.startsWith(month)) continue;
    const k = ii.category || "Boshqa"; catMap.set(k, (catMap.get(k) ?? 0) + (Number(ii.qty) || 0) * (Number(ii.price) || 0));
  }
  const catTotal = [...catMap.values()].reduce((s, x) => s + x, 0) || 1;
  const PIE = ["#3987e5", "#c98500", "#9085e9", "#008300", "#e66767", "#06b6d4"];
  const catSorted = [...catMap.entries()].sort((a, b) => b[1] - a[1]);
  const catTop = catSorted.slice(0, 5);
  const catRest = catSorted.slice(5).reduce((s, [, v]) => s + v, 0);
  if (catRest > 0) catTop.push(["Boshqa", catRest]);
  const categoryPie = catTop.map(([label, value], i) => ({ label, value, pct: Math.round((value / catTotal) * 100), color: PIE[i % PIE.length] }));

  // --- Dinamika (30 kun) ---
  const dynamics: { label: string; value: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    dynamics.push({ label: `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`, value: Math.round((daily.get(iso) ?? 0) / 1e6) });
  }

  // --- Pastki KPI + ogohlantirishlar ---
  const qurilishFilial = (branches ?? []).filter((b) => b.status === "construction").length;
  const ishlabFilial = (branches ?? []).length - qurilishFilial;
  const overBudget = [...budgetByBranch.entries()].filter(([id, bud]) => (runByBranch.get(id) ?? newByBranch.get(id) ?? 0) > bud).length;
  const spikes = countSpikes(items ?? []);
  const alerts = overBudget + spikes + all.filter((r) => r.status === "deadline_dispute").length;

  const data: CeoData = {
    month, dateLabel: `${UZ_MONTHS[now.getMonth()]} ${now.getFullYear()}`,
    big: [
      { key: "total", icon: "💸", label: "Jami xarajat", value: totalSpent, sub: "O'tgan davrga nisbatan", trend: trendPct(totalSpent, prevTotal), grad: "linear-gradient(135deg,#1e3a8a,#2563eb)" },
      { key: "new", icon: "🏗", label: "Qurilish (Yangi filiallar)", value: newTotal, sub: "O'tgan davrga nisbatan", trend: trendPct(newTotal, prevNew), grad: "linear-gradient(135deg,#166534,#22c55e)" },
      { key: "run", icon: "🏢", label: "Ishlab turgan filiallar", value: runTotal, sub: "O'tgan davrga nisbatan", trend: trendPct(runTotal, prevRun), grad: "linear-gradient(135deg,#6d28d9,#a855f7)" },
      { key: "saved", icon: "🛡", label: "Tejalgan summa", value: saved, sub: `Byudjetning ${100 - budgetPct > 0 ? 100 - budgetPct : 0}%`, trend: 0, grad: "linear-gradient(135deg,#b45309,#f59e0b)" },
    ],
    newBlock: { total: newTotal, rows: newRows, donutColor: "#22c55e" },
    runBlock: { total: runTotal, rows: runRows, donutColor: "#a855f7" },
    bottom: [
      { label: "Jami filial", value: String((branches ?? []).length), icon: "🏬", tone: "#3b82f6" },
      { label: "Qurilishdagi", value: String(qurilishFilial), icon: "🏗", tone: "#22c55e" },
      { label: "Ishlayotgan", value: String(ishlabFilial), icon: "🏢", tone: "#a855f7" },
      { label: "Kutilayotgan to'lov", value: shortSom(committed), icon: "⌛", tone: "#f59e0b" },
      { label: "Budjet bajarilishi", value: `${budgetPct}%`, icon: "📊", tone: budgetPct >= 90 ? "#ef4444" : "#22c55e" },
      { label: "Ogohlantirishlar", value: String(alerts), icon: "⚠️", tone: alerts ? "#ef4444" : "#64748b" },
    ],
    detail: {
      constructionTable: newRows, runningTable: runRows, dynamics, categoryPie,
      totalSpent, totalBudget, newTotal, runTotal, saved,
      branches: (branches ?? []).map((b) => ({ id: b.id, name: branchLabel(b.name) })),
      categories: catSorted.map(([c]) => c).slice(0, 12),
    },
  };

  return <CeoDashboard data={data} />;
}

function shortSom(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} mlrd`;
  if (n >= 1e6) return `${Math.round(n / 1e6)} mln`;
  return String(Math.round(n));
}

function countSpikes(items: unknown[]): number {
  const byItem = new Map<string, { price: number; date: string }[]>();
  for (const it of items) {
    const ii = it as { name?: string; category: string | null; price: number | null; report: { created_at: string } | null };
    const key = `${norm(ii.name)}|${norm(ii.category)}`;
    if (!byItem.has(key)) byItem.set(key, []);
    byItem.get(key)!.push({ price: Number(ii.price) || 0, date: ii.report?.created_at ?? "" });
  }
  let n = 0;
  for (const arr of byItem.values()) {
    const a = arr.filter((x) => x.date).sort((x, y) => new Date(x.date).getTime() - new Date(y.date).getTime());
    if (a.length >= 2) { const prev = a[a.length - 2].price, curr = a[a.length - 1].price; if (prev > 0 && curr > prev * 1.3) n++; }
  }
  return n;
}
