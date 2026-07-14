import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/workflow";
import { logAudit } from "@/lib/audit";
import { ROLES, STATUS_LABELS, type Role } from "@/lib/constants";
import { currentMonth, branchLabel } from "@/lib/helpers";
import { evaluateRisk, worstLevel, finalize } from "@/lib/risk/engine";
import { norm, type Purchase, type RequestDoc, type RiskFinding } from "@/lib/risk/types";
import { priceFinding, repeatFinding, docsFindings, REPEAT_WINDOW_DAYS } from "@/lib/risk/purchase";
import { enabledScopes, policyForScope, enabledPolicies } from "@/lib/budget/policy";
import LimitForm from "@/components/LimitForm";
import BudgetBoard, { type BudgetRow, type BudgetExpense, type RiskyRequest } from "./BudgetBoard";
import type { RequestItem } from "@/components/risk/RequestRiskDrawer";
import type { SummaryItem } from "@/components/risk/RiskSummary";

// Budjet yozuvini saqlash (fizik: limits jadvali; policy scope orqali tur aniqlanadi)
async function saveLimit(formData: FormData) {
  "use server";
  const profile = await requireProfile();
  const sb = await createClient();
  const scope = String(formData.get("scope"));
  const ref = String(formData.get("ref"));
  const amount = Number(formData.get("amount") || 0);
  if (!ref || !amount) return;
  await sb.from("limits").upsert({ org_id: profile.org_id, scope, ref, amount }, { onConflict: "org_id,scope,ref" });
  await logAudit(sb, profile.org_id, profile.id, "budget", `Budjet (${scope}: ${ref}) = ${amount.toLocaleString("ru-RU")} so'm`);
  revalidatePath("/budgets");
}

async function deleteLimit(formData: FormData) {
  "use server";
  await requireProfile();
  const sb = await createClient();
  await sb.from("limits").delete().eq("id", Number(formData.get("id")));
  revalidatePath("/budgets");
}

type Rep = { request_id: number; total: number | null; created_at: string; photos_json: string[] | null };
type Item = { name: string; category: string | null; supplier: string | null; qty: number | null; price: number | null; report: { created_at: string; request: { id: number; branch_id: number | null; status: string; created_by: string } | null } | null };

export default async function BudgetsPage() {
  const profile = await requireProfile();
  const month = currentMonth();
  const now = new Date();
  const sb = await createClient();

  const [{ data: limits }, { data: users }, { data: branches }, { data: requests }, { data: reports }, { data: items }] = await Promise.all([
    sb.from("limits").select("id, scope, ref, amount").order("scope"),
    sb.from("profiles").select("id, full_name, role"),
    sb.from("branches").select("id, name"),
    sb.from("requests").select("id, status, branch_id, created_by, created_at, photos_json"),
    sb.from("reports").select("request_id, total, created_at, photos_json"),
    sb.from("report_items").select("name, category, supplier, qty, price, report:reports(created_at, request:requests(id, branch_id, status, created_by))"),
  ]);

  const nameOf = new Map((users ?? []).map((u) => [u.id, u.full_name]));
  const roleOf = new Map((users ?? []).map((u) => [u.id, u.role as string]));
  const branchOf = new Map((branches ?? []).map((b) => [b.id, branchLabel(b.name)]));
  const hasArr = (v: unknown) => Array.isArray(v) && v.length > 0;

  // Zayavka -> yaratuvchi/filial/foto; Hisobot -> zayavka bo'yicha (foto + oy sarfi)
  const reqPhotos = new Map<number, boolean>();
  const reqCreator = new Map<number, string>();
  const reqBranch = new Map<number, number | null>();
  for (const r of (requests ?? []) as { id: number; created_by: string; branch_id: number | null; photos_json: string[] | null }[]) { reqPhotos.set(r.id, hasArr(r.photos_json)); reqCreator.set(r.id, r.created_by); reqBranch.set(r.id, r.branch_id); }
  const reportByReq = new Map<number, { hasPhotos: boolean }>();
  const spentByUser = new Map<string, number>();
  const spentByBranch = new Map<number, number>();
  for (const rp of (reports ?? []) as Rep[]) {
    reportByReq.set(rp.request_id, { hasPhotos: hasArr(rp.photos_json) });
    if (rp.created_at?.startsWith(month)) {
      const u = reqCreator.get(rp.request_id); if (u) spentByUser.set(u, (spentByUser.get(u) ?? 0) + (Number(rp.total) || 0));
      const b = reqBranch.get(rp.request_id); if (b != null) spentByBranch.set(b, (spentByBranch.get(b) ?? 0) + (Number(rp.total) || 0));
    }
  }

  // 1-bosqich: eng arzon narx (butun tizim) + foydalanuvchi xaridlari
  const benchmarkMin = new Map<string, number>();
  const purchasesByUser = new Map<string, Purchase[]>();
  const allItems = (items ?? []) as unknown as Item[];
  for (const it of allItems) {
    const price = Number(it.price) || 0;
    if (it.name && price > 0) { const k = norm(it.name); const m = benchmarkMin.get(k); if (m == null || price < m) benchmarkMin.set(k, price); }
    const u = it.report?.request?.created_by;
    if (u && it.report) (purchasesByUser.get(u) ?? purchasesByUser.set(u, []).get(u)!).push({ name: it.name, price, qty: Number(it.qty) || 0, at: it.report.created_at });
  }
  // Takroriy xarid soni (foydalanuvchi+mahsulot, oxirgi 15 kun)
  const windowMs = REPEAT_WINDOW_DAYS * 86_400_000;
  const repeatCount = new Map<string, number>();
  for (const [u, ps] of purchasesByUser) for (const p of ps) if (now.getTime() - new Date(p.at).getTime() <= windowMs) { const k = `${u}|${norm(p.name)}`; repeatCount.set(k, (repeatCount.get(k) ?? 0) + 1); }

  // 2-bosqich: joriy oy xarajatlari + har xarid uchun findings (AI Risk primitivlaridan)
  const expensesByUser = new Map<string, BudgetExpense[]>();
  const expensesByBranch = new Map<string, BudgetExpense[]>();       // key: branch_id
  const expensesByCategory = new Map<string, BudgetExpense[]>();     // key: kategoriya nomi
  const purchasesByBranch = new Map<string, Purchase[]>();
  const purchasesByCategory = new Map<string, Purchase[]>();
  const spentByCategory = new Map<string, number>();
  const push = <T,>(m: Map<string, T[]>, k: string, v: T) => (m.get(k) ?? m.set(k, []).get(k)!).push(v);
  type ReqAgg = { reqId: number; date: string; employee: string; branch: string; hasReceipt: boolean; hasPhoto: boolean; items: RequestItem[] };
  const reqAgg = new Map<number, ReqAgg>();
  for (const it of allItems) {
    const req = it.report?.request;
    if (!req?.created_by || !it.report || !it.report.created_at?.startsWith(month)) continue;
    const u = req.created_by, price = Number(it.price) || 0, rep = reportByReq.get(req.id), amount = (Number(it.qty) || 0) * price;
    const findings: RiskFinding[] = [];
    const pf = priceFinding(it.name, price, benchmarkMin); if (pf) findings.push(pf);
    const rf = repeatFinding(it.name, repeatCount.get(`${u}|${norm(it.name)}`) ?? 0); if (rf) findings.push(rf);
    findings.push(...docsFindings(!!rep, rep?.hasPhotos ?? false));
    const branch = req.branch_id ? branchOf.get(req.branch_id) ?? "—" : "—";
    const catKey = it.category || "Boshqa";
    const exp: BudgetExpense = {
      date: formatDate(it.report.created_at), reqId: req.id, name: it.name, category: it.category,
      branch, amount, supplier: it.supplier, employee: nameOf.get(u) ?? "—", hasReceipt: !!rep, hasPhoto: rep?.hasPhotos ?? false,
      statusLabel: STATUS_LABELS[req.status] ?? req.status, findings, riskLevel: findings.length ? worstLevel(findings.map((f) => f.level)) : "good",
    };
    push(expensesByUser, u, exp);
    if (req.branch_id != null) { push(expensesByBranch, String(req.branch_id), exp); push(purchasesByBranch, String(req.branch_id), { name: it.name, price, qty: Number(it.qty) || 0, at: it.report.created_at }); }
    push(expensesByCategory, catKey, exp);
    push(purchasesByCategory, catKey, { name: it.name, price, qty: Number(it.qty) || 0, at: it.report.created_at });
    spentByCategory.set(catKey, (spentByCategory.get(catKey) ?? 0) + amount);
    // Zayavka bo'yicha to'plash (har zayavka alohida tahlil uchun)
    const ra: ReqAgg = reqAgg.get(req.id) ?? { reqId: req.id, date: formatDate(it.report.created_at), employee: nameOf.get(u) ?? "—", branch, hasReceipt: !!rep, hasPhoto: rep?.hasPhotos ?? false, items: [] };
    ra.items.push({ name: it.name, category: it.category, amount, supplier: it.supplier, findings });
    reqAgg.set(req.id, ra);
  }

  // Xavfli zayavkalar ro'yxati (har biri alohida; drawer faqat shu zayavkani ko'rsatadi)
  const riskyRequests: RiskyRequest[] = [...reqAgg.values()]
    .map((ra) => {
      const seen = new Set<string>(); const all: RiskFinding[] = [];
      for (const it of ra.items) for (const f of it.findings) if (!seen.has(f.title)) { seen.add(f.title); all.push(f); }
      const res = finalize(all);
      const req: RiskyRequest = {
        reqId: ra.reqId, hasReceipt: ra.hasReceipt, hasPhoto: ra.hasPhoto, items: ra.items, date: ra.date, employee: ra.employee,
        position: ROLES[roleOf.get(reqCreator.get(ra.reqId) ?? "") as Role] ?? "", branch: ra.branch,
        amount: ra.items.reduce((s, i) => s + i.amount, 0), riskLevel: res.level, ruleIds: [...new Set(res.findings.map((f) => f.ruleId))],
        topReason: res.findings[0]?.detail ?? "",
      };
      return { req, score: res.score };
    })
    .filter((x) => x.req.riskLevel !== "good")
    .sort((a, b) => b.score - a.score)
    .map((x) => x.req);

  // Foydalanuvchi bo'yicha hujjat holati (joriy oy)
  const docsByUser = new Map<string, RequestDoc[]>();
  for (const r of (requests ?? []) as { id: number; status: string; created_by: string; created_at: string }[]) {
    if (!r.created_at?.startsWith(month)) continue;
    const rep = reportByReq.get(r.id);
    (docsByUser.get(r.created_by) ?? docsByUser.set(r.created_by, []).get(r.created_by)!).push({ id: r.id, status: r.status, hasReport: !!rep, hasPhotos: (rep?.hasPhotos ?? false) || reqPhotos.get(r.id) === true });
  }

  const usersOfRole = (role: string) => (users ?? []).filter((u) => u.role === role).map((u) => u.id);
  const agg = <T,>(ids: string[], m: Map<string, T[]>): T[] => ids.flatMap((id) => m.get(id) ?? []);

  // --- Budjet qatorlari: yoqilgan scope'lar (role / user / branch / category) ---
  const scopes = new Set(enabledScopes());
  const rows: BudgetRow[] = ((limits ?? []) as { id: number; scope: string; ref: string; amount: number }[])
    .filter((l) => scopes.has(l.scope))
    .map((l) => {
      // Scope'ga qarab: sarf, xarajatlar, xaridlar va yorliq turlicha yig'iladi
      let spent = 0, expenses: BudgetExpense[] = [], purchases: Purchase[] = [], docs: RequestDoc[] = [], label = l.ref;
      if (l.scope === "user") {
        spent = spentByUser.get(l.ref) ?? 0; expenses = expensesByUser.get(l.ref) ?? []; purchases = purchasesByUser.get(l.ref) ?? []; docs = docsByUser.get(l.ref) ?? [];
        label = nameOf.get(l.ref) ?? `#${l.ref}`;
      } else if (l.scope === "role") {
        const ids = usersOfRole(l.ref);
        spent = ids.reduce((s, id) => s + (spentByUser.get(id) ?? 0), 0);
        expenses = agg(ids, expensesByUser); purchases = agg(ids, purchasesByUser); docs = agg(ids, docsByUser);
        label = ROLES[l.ref as Role] ?? l.ref;
      } else if (l.scope === "branch") {
        spent = spentByBranch.get(Number(l.ref)) ?? 0; expenses = expensesByBranch.get(l.ref) ?? []; purchases = purchasesByBranch.get(l.ref) ?? [];
        label = branchOf.get(Number(l.ref)) ?? `#${l.ref}`;
      } else if (l.scope === "category") {
        spent = spentByCategory.get(l.ref) ?? 0; expenses = expensesByCategory.get(l.ref) ?? []; purchases = purchasesByCategory.get(l.ref) ?? [];
        label = l.ref;
      }
      const risk = evaluateRisk({ limit: Number(l.amount), spent, purchases, benchmarkMin, requests: docs, now });
      return {
        key: `${l.scope}:${l.ref}`, scope: l.scope, label, subtitle: policyForScope(l.scope)?.subtitleFor(l.scope) ?? l.scope, limitId: l.id,
        limit: Number(l.amount), spent, pct: l.amount ? Math.round((spent / Number(l.amount)) * 100) : 0,
        risk, expenses: expenses.slice().sort((a, b) => (a.date < b.date ? 1 : -1)), findingRules: risk.findings.map((f) => f.ruleId),
      };
    })
    .sort((a, b) => b.risk.score - a.risk.score);

  const countWith = (rule: string) => rows.filter((p) => p.findingRules.includes(rule)).length;
  const summary: SummaryItem[] = [
    { ruleId: "limit", label: "Limitdan oshgan / xavf", count: countWith("limit"), unit: "lavozim", level: "critical" },
    { ruleId: "price", label: "Narx anomaliyasi", count: countWith("price"), unit: "lavozim", level: "risk" },
    { ruleId: "repeat", label: "Takroriy xarid", count: countWith("repeat"), unit: "lavozim", level: "risk" },
    { ruleId: "docs", label: "Hujjat muammolari", count: countWith("docs"), unit: "lavozim", level: "critical" },
  ];

  const policyLabels = enabledPolicies().map((p) => p.label).join(" · ");

  // Budjetni FAQAT moliyachi boshqaradi va hammasini ko'radi.
  // (Admin faqat ruxsatlarni boshqaradi — budjetга aralashmaydi.)
  // Boshqa lavozim egasi FAQAT o'ziga ajratilgan budjetni ko'radi (read-only).
  const isBudgetManager = profile.role === "finance";
  const myRows = rows.filter((r) => r.key === `role:${profile.role}` || r.key === `user:${profile.id}`);

  if (!isBudgetManager) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Mening budjetim</h1>
          <p className="text-xs" style={{ color: "var(--muted)" }}>Sizga ajratilgan budjet · {month}</p>
        </div>
        <MyBudget rows={myRows} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Budjet</h1>
        <p className="text-xs" style={{ color: "var(--muted)" }}>{policyLabels} bo&apos;yicha nazorat · AI Risk · {month}</p>
      </div>

      <LimitForm action={saveLimit}
        branches={(branches ?? []).map((b) => ({ id: String(b.id), name: b.name }))}
        users={(users ?? []).map((u) => ({ id: u.id, name: u.full_name }))} />

      <BudgetBoard rows={rows} riskyRequests={riskyRequests} summary={summary} deleteLimit={deleteLimit} />
    </div>
  );
}

// --- Shaxsiy budjet ko'rinishi (read-only) — lavozim egasi faqat o'zinikini ko'radi ---
function MyBudget({ rows }: { rows: BudgetRow[] }) {
  if (rows.length === 0) {
    return <div className="rounded-2xl p-10 text-center text-sm" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}>Sizga hali budjet ajratilmagan. Moliyachi bilan bog&apos;laning.</div>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {rows.map((r) => {
        const remaining = r.limit - r.spent;
        const over = r.pct >= 100;
        const barColor = over ? "#ef4444" : r.pct >= 90 ? "#f59e0b" : r.pct >= 75 ? "#fbbf24" : "#22c55e";
        return (
          <div key={r.key} className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 10px 28px -20px rgba(0,0,0,.5)" }}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="font-semibold">{r.label}</div>
                <div className="text-[11px]" style={{ color: "var(--muted)" }}>{r.subtitle} budjeti</div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: `${barColor}1f`, color: barColor }}>{r.pct}%</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center mb-4">
              <div><div className="text-[11px]" style={{ color: "var(--muted)" }}>Limit</div><div className="text-sm font-bold tabular-nums mt-0.5">{formatMoney(r.limit)}</div></div>
              <div><div className="text-[11px]" style={{ color: "var(--muted)" }}>Sarflangan</div><div className="text-sm font-bold tabular-nums mt-0.5">{formatMoney(r.spent)}</div></div>
              <div><div className="text-[11px]" style={{ color: "var(--muted)" }}>Qoldiq</div><div className="text-sm font-bold tabular-nums mt-0.5" style={{ color: remaining < 0 ? "#ef4444" : "#22c55e" }}>{formatMoney(remaining)}</div></div>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(r.pct, 100)}%`, background: barColor, transition: "width .6s cubic-bezier(.16,1,.3,1)" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
