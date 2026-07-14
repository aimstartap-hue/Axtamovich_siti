import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { formatDate } from "@/lib/workflow";
import { toSom, type Rates } from "@/lib/currency";
import { OPENING_STAGES_FULL, OPENING_ROLES, STATUS_LABELS } from "@/lib/constants";
import { currentMonth } from "@/lib/helpers";
import { evaluateRisk, worstLevel } from "@/lib/risk/engine";
import { weightedProgress } from "@/lib/opening/template";
import { norm, type Purchase, type RequestDoc, type RiskFinding, type RiskLevel } from "@/lib/risk/types";
import { priceFinding, repeatFinding, docsFindings, REPEAT_WINDOW_DAYS } from "@/lib/risk/purchase";
import RequestKpis, { type KpiItem } from "@/app/(app)/requests/RequestKpis";
import OpeningFilters from "./OpeningFilters";
import OpeningsBoard, { type OpeningProject, type OpeningExpense, type CategoryLine, type OpeningEvent } from "./OpeningsBoard";

const DEAD = ["closed", "rejected"];
const toneOf = (s: string): RiskLevel | "info" => s === "closed" ? "good" : s === "rejected" ? "critical" : ["pending_axo", "pending_ceo", "pending_finance"].includes(s) ? "attention" : "info";

type SP = Promise<{ month?: string; status?: string; q?: string; kpi?: string }>;

export default async function OpeningsPage({ searchParams }: { searchParams: SP }) {
  const profile = await requireProfile();
  if (!OPENING_ROLES.includes(profile.role)) redirect("/");
  const sb = await createClient();
  const sp = await searchParams;
  const now = new Date();
  const month = currentMonth();

  const { data: reqs } = await sb.from("requests")
    .select("id, title, status, estimated_amount, estimated_currency, deadline, created_at, created_by, opening_stages, opening_project, opening_budget")
    .eq("type", "new_branch").order("id", { ascending: false });
  const projRows = (reqs ?? []) as {
    id: number; title: string; status: string; estimated_amount: number | null; estimated_currency: string | null; deadline: string | null;
    created_at: string; created_by: string; opening_stages: Record<string, boolean> | null; opening_project: string | null; opening_budget: Record<string, number> | null;
  }[];
  const ids = projRows.map((p) => p.id);

  const [{ data: reports }, { data: events }, { data: people }, { data: rateRows }, { data: bench }] = await Promise.all([
    ids.length ? sb.from("reports").select("id, request_id, total, created_at, photos_json").in("request_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? sb.from("events").select("request_id, action, user_id, comment, created_at").in("request_id", ids).order("created_at", { ascending: true }) : Promise.resolve({ data: [] }),
    sb.from("profiles").select("id, full_name"),
    sb.from("exchange_rates").select("currency, rate"),
    sb.from("report_items").select("name, price"),
  ]);

  const reportRows = (reports ?? []) as { id: number; request_id: number; total: number | null; created_at: string; photos_json: string[] | null }[];
  const reportIds = reportRows.map((r) => r.id);
  const { data: items } = reportIds.length
    ? await sb.from("report_items").select("report_id, name, category, supplier, qty, price").in("report_id", reportIds)
    : { data: [] };

  const nameOf = new Map((people ?? []).map((u) => [u.id, u.full_name]));
  const rates: Rates = {};
  for (const r of rateRows ?? []) rates[(r as { currency: string }).currency] = (r as { rate: number }).rate;
  const hasArr = (v: unknown) => Array.isArray(v) && v.length > 0;

  // Eng arzon narx (butun tizim) — narx anomaliyasi uchun
  const benchmarkMin = new Map<string, number>();
  for (const it of (bench ?? []) as { name: string; price: number | null }[]) { const p = Number(it.price) || 0; if (it.name && p > 0) { const k = norm(it.name); const m = benchmarkMin.get(k); if (m == null || p < m) benchmarkMin.set(k, p); } }

  // Hisobot -> zayavka
  const reportInfo = new Map<number, { reqId: number; createdAt: string; hasPhotos: boolean }>();
  const reportsByReq = new Map<number, { total: number; hasPhotos: boolean }[]>();
  for (const r of reportRows) {
    const hasPhotos = hasArr(r.photos_json);
    reportInfo.set(r.id, { reqId: r.request_id, createdAt: r.created_at, hasPhotos });
    (reportsByReq.get(r.request_id) ?? reportsByReq.set(r.request_id, []).get(r.request_id)!).push({ total: Number(r.total) || 0, hasPhotos });
  }
  // Xaridlar -> zayavka
  type It = { report_id: number; name: string; category: string | null; supplier: string | null; qty: number | null; price: number | null };
  const itemsByReq = new Map<number, { name: string; category: string | null; supplier: string | null; qty: number; price: number; at: string; hasPhotos: boolean }[]>();
  for (const it of (items ?? []) as It[]) {
    const ri = reportInfo.get(it.report_id); if (!ri) continue;
    (itemsByReq.get(ri.reqId) ?? itemsByReq.set(ri.reqId, []).get(ri.reqId)!).push({ name: it.name, category: it.category, supplier: it.supplier, qty: Number(it.qty) || 0, price: Number(it.price) || 0, at: ri.createdAt, hasPhotos: ri.hasPhotos });
  }
  // Timeline
  const eventsByReq = new Map<number, OpeningEvent[]>();
  for (const e of (events ?? []) as { request_id: number; action: string; user_id: string | null; comment: string | null; created_at: string }[]) {
    (eventsByReq.get(e.request_id) ?? eventsByReq.set(e.request_id, []).get(e.request_id)!).push({ action: e.action, who: e.user_id ? nameOf.get(e.user_id) ?? "—" : "Tizim", at: formatDate(e.created_at), comment: e.comment });
  }

  // --- Loyihalarni qurish ---
  const all: OpeningProject[] = projRows.map((r) => {
    const budget = toSom(Number(r.estimated_amount ?? 0), r.estimated_currency, rates);
    const reps = reportsByReq.get(r.id) ?? [];
    const spent = reps.reduce((s, x) => s + x.total, 0);
    const projItems = itemsByReq.get(r.id) ?? [];
    const stages = OPENING_STAGES_FULL.map((s) => ({ key: s.key, label: s.label, done: !!r.opening_stages?.[s.key] }));
    const firstPending = stages.find((s) => !s.done);
    const progress = weightedProgress(r.opening_stages);

    // Takroriy xarid (loyiha ichida, 15 kun)
    const rc = new Map<string, number>();
    for (const it of projItems) if (now.getTime() - new Date(it.at).getTime() <= REPEAT_WINDOW_DAYS * 86_400_000) { const k = norm(it.name); rc.set(k, (rc.get(k) ?? 0) + 1); }

    const expenses: OpeningExpense[] = projItems.map((it) => {
      const findings: RiskFinding[] = [];
      const pf = priceFinding(it.name, it.price, benchmarkMin); if (pf) findings.push(pf);
      const rf = repeatFinding(it.name, rc.get(norm(it.name)) ?? 0); if (rf) findings.push(rf);
      findings.push(...docsFindings(true, it.hasPhotos));
      return { date: formatDate(it.at), reqId: r.id, name: it.name, category: it.category, amount: it.qty * it.price, supplier: it.supplier, employee: nameOf.get(r.created_by) ?? "—", hasReceipt: true, hasPhoto: it.hasPhotos, findings, riskLevel: findings.length ? worstLevel(findings.map((f) => f.level)) : "good" };
    });

    const purchases: Purchase[] = projItems.map((it) => ({ name: it.name, price: it.price, qty: it.qty, at: it.at }));
    const docs: RequestDoc[] = [{ id: r.id, status: r.status, hasReport: reps.length > 0, hasPhotos: reps.some((x) => x.hasPhotos) }];
    const risk = evaluateRisk({ limit: budget, spent, purchases, benchmarkMin, requests: docs, now });

    // Kategoriya reja/sarf
    const catPlan = new Map<string, number>();
    for (const [k, v] of Object.entries(r.opening_budget ?? {})) catPlan.set(k, Number(v));
    const catSpent = new Map<string, number>();
    for (const it of projItems) if (it.category) catSpent.set(it.category, (catSpent.get(it.category) ?? 0) + it.qty * it.price);
    const categories: CategoryLine[] = [...new Set([...catPlan.keys(), ...catSpent.keys()])]
      .map((name) => ({ name, plan: catPlan.get(name) ?? 0, spent: catSpent.get(name) ?? 0 })).sort((a, b) => b.spent - a.spent);

    const timeline = eventsByReq.get(r.id) ?? [];
    const facets: string[] = [];
    if (!DEAD.includes(r.status)) facets.push("active");
    if (r.status === "closed") facets.push("done");
    if (risk.level !== "good") facets.push("risky");
    if (budget > 0 && spent > budget) facets.push("over_budget");
    if (r.deadline?.startsWith(month)) facets.push("this_month_plan");

    return {
      id: r.id, title: r.title, project: r.opening_project, manager: nameOf.get(r.created_by) ?? "—", address: r.opening_project ?? "—",
      startDate: formatDate(r.created_at), plannedDate: r.deadline ? formatDate(r.deadline) : "—", actualDate: r.status === "closed" && timeline.length ? timeline[timeline.length - 1].at : "—",
      statusLabel: STATUS_LABELS[r.status] ?? r.status, statusTone: toneOf(r.status), note: "",
      stages, progress, currentStage: firstPending ? firstPending.label : "Ochildi", budget, spent, remaining: budget - spent,
      risk, facets, timeline, categories, expenses, photoCount: reps.filter((x) => x.hasPhotos).length,
    };
  });

  // --- Server filtrlar (oy/holat/qidiruv) ---
  const q = (sp.q ?? "").toLowerCase().trim();
  const scope = all.filter((p) => {
    if (sp.month && !(p.startDate.split(".").reverse().join("-").startsWith(sp.month) || (p.plannedDate !== "—" && p.plannedDate.split(".").reverse().join("-").startsWith(sp.month)))) return false;
    if (sp.status === "active" && !p.facets.includes("active")) return false;
    if (sp.status === "done" && !p.facets.includes("done")) return false;
    if (sp.status === "problem" && !p.facets.includes("risky")) return false;
    if (q && !p.title.toLowerCase().includes(q)) return false;
    return true;
  });

  // --- KPI (scope bo'yicha, clickable facet) ---
  const cnt = (f: string) => scope.filter((p) => p.facets.includes(f)).length;
  const sum = (sel: (p: OpeningProject) => number) => scope.reduce((s, p) => s + sel(p), 0);
  const kpis: KpiItem[] = [
    { icon: "🏪", label: "Jami loyihalar", value: String(scope.length), sub: "ochilish", accent: "#4f9bf5" },
    { icon: "🚧", label: "Jarayonda", value: String(cnt("active")), sub: "faol loyiha", accent: "#fb923c", facet: "active" },
    { icon: "✅", label: "Tugallandi", value: String(cnt("done")), sub: "ochilgan", accent: "#22c55e", facet: "done" },
    { icon: "⚠️", label: "Muammoli", value: String(cnt("risky")), sub: "AI xavf", accent: "#f87171", facet: "risky" },
    { icon: "💰", label: "Jami byudjet", value: formatMoney(sum((p) => p.budget)), sub: "rejalashtirilgan", accent: "#4f9bf5" },
    { icon: "💵", label: "Jami sarflangan", value: formatMoney(sum((p) => p.spent)), sub: "haqiqiy", accent: "#22c55e" },
    { icon: "⏳", label: "Shu oy ochilishi", value: String(cnt("this_month_plan")), sub: "rejalashtirilgan", accent: "#fbbf24", facet: "this_month_plan" },
    { icon: "🔴", label: "Byudjetdan oshgan", value: String(cnt("over_budget")), sub: "filial", accent: "#f87171", facet: "over_budget" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Ochilish nazorati</h1>
        <p className="text-xs" style={{ color: "var(--muted)" }}>Filial ochilish jarayoni · bosqichlar · xarajatlar · AI xavf tahlili</p>
      </div>

      <OpeningFilters />
      <RequestKpis items={kpis} />
      <OpeningsBoard projects={scope} />
    </div>
  );
}
