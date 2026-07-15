import { FileText, Clock, CreditCard, AlarmClock, Flame, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { currentMonth, monthRange, currentMonthBounds, isOpen } from "@/lib/helpers";
import { currentOwner } from "@/lib/requests-view";
import { FINANCE_ROLES, type Priority } from "@/lib/constants";
import RequestKpis, { type KpiItem } from "./RequestKpis";
import RequestsTable, { type TableRow } from "./RequestsTable";

export interface RequestsSP { q?: string; status?: string; type?: string; priority?: string; branch?: string; owner?: string; from?: string; to?: string; kpi?: string }

const PENDING = ["pending_axo", "pending_ceo", "pending_finance"];
const daysSince = (iso: string, now: Date) => Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
const addDay = (d: string) => new Date(new Date(d).getTime() + 86_400_000).toISOString().slice(0, 10);

type Req = { id: number; type: "maintenance" | "new_branch"; title: string; status: string; priority: Priority | null; deadline: string | null; created_at: string; estimated_amount: number | null; estimated_category: string | null; branch_id: number | null; created_by: string; paid: boolean | null; paid_at: string | null };

// Zayavkalar boshqaruv paneli — KPI va jadval BITTA so'rov + BITTA filter state.
// Barcha statistika joriy filterga mos (umumiy statistika emas). Default: joriy oy.
export default async function RequestsBoard({ sp, branches }: { sp: RequestsSP; branches: { id: number; name: string }[] }) {
  const sb = await createClient();
  const profile = await requireProfile();
  const now = new Date();
  const bounds = currentMonthBounds(now);
  const from = sp.from || bounds.from;
  const to = sp.to || bounds.to;

  // Ko'rish qamrovi: CEO/Moliya/admin (ofis vakillari) hammasini ko'radi;
  // qolgan akkauntlar FAQAT o'zi yaratgan zayavkalarni (rasxodlarni) ko'radi.
  const fullView = FINANCE_ROLES.includes(profile.role);

  // --- Server-side scope: davr + filial + tur + status + prioritet ---
  let query = sb.from("requests")
    .select("id, type, title, status, priority, deadline, created_at, estimated_amount, estimated_category, branch_id, created_by, paid, paid_at")
    .gte("created_at", from).lt("created_at", addDay(to)).order("id", { ascending: false });
  if (!fullView) query = query.eq("created_by", profile.id);
  if (sp.branch) query = query.eq("branch_id", Number(sp.branch));
  if (sp.type) query = query.eq("type", sp.type);
  if (sp.status) query = query.eq("status", sp.status);
  if (sp.priority) query = query.eq("priority", sp.priority);

  const [{ data: reqs }, { data: people }, { data: budgets }, { data: events }, { data: reports }] = await Promise.all([
    query,
    sb.from("profiles").select("id, full_name"),
    sb.from("budgets").select("branch_id, category, amount").eq("month", currentMonth()),
    sb.from("events").select("request_id, action, comment, user_id, created_at").order("created_at", { ascending: true }),
    sb.from("reports").select("request_id, total, created_at, request:requests(branch_id)"),
  ]);

  const branchName = new Map(branches.map((b) => [b.id, b.name]));
  const profileName = new Map(((people ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]));

  // --- Owner + qidiruv (derived) -> base to'plam ---
  const q = (sp.q ?? "").toLowerCase().trim();
  const base = ((reqs ?? []) as Req[]).filter((r) => {
    if (sp.owner && currentOwner(r.status) !== sp.owner) return false;
    if (q && !(r.title.toLowerCase().includes(q) || String(r.id) === q.replace("#", ""))) return false;
    return true;
  });

  // --- Events -> oxirgi harakat ---
  const lastAction = new Map<number, { text: string; at: string }>();
  for (const e of (events ?? []) as { request_id: number; action: string; created_at: string }[]) {
    lastAction.set(e.request_id, { text: e.action, at: e.created_at });
  }

  // --- Reports -> haqiqiy summa + joriy oy filial sarfi (byudjet) ---
  const actualByReq = new Map<number, number>();
  const { start: mStart, end: mEnd } = monthRange(currentMonth());
  const spentByBranch = new Map<number, number>();
  for (const rp of (reports ?? []) as unknown as { request_id: number; total: number | null; created_at: string; request: { branch_id: number | null } | null }[]) {
    const t = Number(rp.total) || 0;
    actualByReq.set(rp.request_id, (actualByReq.get(rp.request_id) ?? 0) + t);
    if (rp.created_at >= mStart && rp.created_at < mEnd && rp.request?.branch_id) spentByBranch.set(rp.request.branch_id, (spentByBranch.get(rp.request.branch_id) ?? 0) + t);
  }
  const overBudgetBranches = new Set<number>();
  for (const b of budgets ?? []) if ((b.category ?? "") === "" && Number(b.amount) > 0 && (spentByBranch.get(b.branch_id) ?? 0) > Number(b.amount)) overBudgetBranches.add(b.branch_id);

  // --- Facet predikatlari (KPI karta bosilганда jadvalni filtrlaydi) ---
  const facetFns: Record<string, (r: Req) => boolean> = {
    pending: (r) => PENDING.includes(r.status),
    paid_today: (r) => !!r.paid && r.paid_at?.slice(0, 10) === now.toISOString().slice(0, 10),
    overdue: (r) => isOpen(r.status) && !!r.deadline && new Date(r.deadline) < now,
    high: (r) => r.priority === "urgent" && isOpen(r.status),
    over_budget: (r) => !!r.branch_id && overBudgetBranches.has(r.branch_id),
  };

  // --- KPI (base to'plam bo'yicha — filterga mos) ---
  const sumEst = (rs: Req[]) => rs.reduce((s, r) => s + Number(r.estimated_amount ?? 0), 0);
  const oldest = (rs: Req[]) => (rs.length ? Math.max(...rs.map((r) => daysSince(r.created_at, now))) : 0);
  const pend = base.filter(facetFns.pending);
  const paid = base.filter(facetFns.paid_today);
  const over = base.filter(facetFns.overdue);
  const high = base.filter(facetFns.high);
  const overBudgetInScope = new Set(base.filter(facetFns.over_budget).map((r) => r.branch_id));

  const kpis: KpiItem[] = [
    { icon: <FileText size={16} />, label: "Jami zayavkalar", value: String(base.length), sub: "tanlangan davr", accent: "#3987e5" },
    { icon: <Clock size={16} />, label: "Tasdiq kutmoqda", value: formatMoney(sumEst(pend)), sub: `${pend.length} ta`, hint: pend.length ? `eng eski: ${oldest(pend)} kun` : undefined, accent: "#fbbf24", facet: "pending" },
    { icon: <CreditCard size={16} />, label: "Bugungi to'lov", value: formatMoney(sumEst(paid)), sub: `${paid.length} ta`, accent: "#22c55e", facet: "paid_today" },
    { icon: <AlarmClock size={16} />, label: "Kechiktirilgan", value: formatMoney(sumEst(over)), sub: `${over.length} ta`, hint: over.length ? `eng eski: ${oldest(over)} kun` : undefined, accent: "#f87171", facet: "overdue" },
    { icon: <Flame size={16} />, label: "Yuqori ustuvorlik", value: String(high.length), sub: formatMoney(sumEst(high)), accent: "#fb923c", facet: "high" },
    { icon: <TrendingUp size={16} />, label: "Byudjetdan oshgan", value: String(overBudgetInScope.size), sub: overBudgetInScope.size ? "filial nazoratda" : "filial", accent: "#a78bfa", facet: "over_budget" },
  ];

  // --- Jadval = base ∩ faol facet ---
  const facet = sp.kpi && facetFns[sp.kpi] ? facetFns[sp.kpi] : null;
  const tableSet = facet ? base.filter(facet) : base;
  const rows: TableRow[] = tableSet.map((r) => {
    const la = lastAction.get(r.id);
    return {
      id: r.id, type: r.type, title: r.title, branch: r.branch_id ? branchName.get(r.branch_id) ?? "—" : "—",
      category: r.estimated_category, requested: r.estimated_amount != null ? Number(r.estimated_amount) : null,
      actual: actualByReq.get(r.id) ?? null, status: r.status, priority: r.priority, owner: currentOwner(r.status),
      requester: profileName.get(r.created_by) ?? "—", lastActionText: la?.text ?? null, lastActionAt: la?.at ?? null,
      deadline: r.deadline, createdAt: r.created_at,
    };
  });

  return (
    <div className="space-y-4">
      <RequestKpis items={kpis} />
      <RequestsTable rows={rows} />
    </div>
  );
}
