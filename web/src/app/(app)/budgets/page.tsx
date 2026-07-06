import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { ROLES, EXPENSE_CATEGORIES, type Role } from "@/lib/constants";
import MonthFilter from "@/components/MonthFilter";
import BudgetImport from "@/components/BudgetImport";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function prevMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const COMMITTED_STATUSES = ["approved", "funded", "manager_doing", "axo_review"];

// --- Server actions ---------------------------------------------------------
async function saveBudget(formData: FormData) {
  "use server";
  const profile = await requireProfile();
  const sb = await createClient();
  const branch_id = Number(formData.get("branch_id"));
  const month = String(formData.get("month") || currentMonth());
  const category = String(formData.get("category") || "");
  const amount = Number(String(formData.get("amount") || "0").replace(/[^\d.]/g, ""));
  await sb.from("budgets").upsert(
    { org_id: profile.org_id, branch_id, month, category, amount },
    { onConflict: "branch_id,month,category" },
  );
  await logAudit(sb, profile.org_id, profile.id, "budget", `Byudjet (${month}${category ? " · " + category : ""}) = ${amount.toLocaleString("ru-RU")} so'm`);
  revalidatePath("/budgets");
}

async function copyLastMonth(formData: FormData) {
  "use server";
  const profile = await requireProfile();
  const sb = await createClient();
  const month = String(formData.get("month") || currentMonth());
  const prev = prevMonth(month);
  const { data: rows } = await sb.from("budgets").select("branch_id, category, amount").eq("month", prev);
  if (rows?.length) {
    await sb.from("budgets").upsert(
      rows.map((r) => ({ org_id: profile.org_id, branch_id: r.branch_id, category: r.category ?? "", month, amount: r.amount })),
      { onConflict: "branch_id,month,category" },
    );
    await logAudit(sb, profile.org_id, profile.id, "budget", `${prev} byudjeti ${month} ga nusxalandi (${rows.length} ta)`);
  }
  revalidatePath("/budgets");
}

async function applyAnnual(formData: FormData) {
  "use server";
  const profile = await requireProfile();
  const sb = await createClient();
  const month = String(formData.get("month") || currentMonth());
  const year = month.split("-")[0];
  const { data: rows } = await sb.from("budgets").select("branch_id, category, amount").eq("month", month);
  if (rows?.length) {
    const all = [];
    for (let m = 1; m <= 12; m++) {
      const ym = `${year}-${String(m).padStart(2, "0")}`;
      for (const r of rows) all.push({ org_id: profile.org_id, branch_id: r.branch_id, category: r.category ?? "", month: ym, amount: r.amount });
    }
    await sb.from("budgets").upsert(all, { onConflict: "branch_id,month,category" });
    await logAudit(sb, profile.org_id, profile.id, "budget", `${month} byudjeti butun ${year} yilga qo'llandi`);
  }
  revalidatePath("/budgets");
}

async function importBudgets(formData: FormData) {
  "use server";
  const profile = await requireProfile();
  const sb = await createClient();
  const month = String(formData.get("month") || currentMonth());
  const rows = JSON.parse(String(formData.get("rows_json") || "[]")) as { branch_id: number; category: string; amount: number }[];
  if (rows.length) {
    await sb.from("budgets").upsert(
      rows.map((r) => ({ org_id: profile.org_id, branch_id: r.branch_id, category: r.category || "", month, amount: r.amount })),
      { onConflict: "branch_id,month,category" },
    );
    await logAudit(sb, profile.org_id, profile.id, "budget", `Excel'dan ${rows.length} ta byudjet import qilindi (${month})`);
  }
  revalidatePath("/budgets");
}

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireProfile();
  const sp = await searchParams;
  const month = sp.month || currentMonth();
  const sb = await createClient();

  const now = new Date();
  const isCurrentMonth = month === currentMonth();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const elapsed = isCurrentMonth ? now.getDate() / daysInMonth : 1;

  const [{ data: branches }, { data: budgets }, { data: reports }, { data: commits }, { data: catItems }] = await Promise.all([
    sb.from("branches").select("id, name").order("name"),
    sb.from("budgets").select("branch_id, category, amount").eq("month", month),
    sb.from("reports").select("total, created_at, request:requests(branch_id, created_by, creator:profiles!created_by(role))"),
    sb.from("requests").select("branch_id, estimated_amount, limit_amount").in("status", COMMITTED_STATUSES),
    sb.from("report_items").select("category, qty, price, report:reports(created_at, request:requests(branch_id))"),
  ]);

  // Byudjet: branch -> (category -> amount). category '' = filial umumiy.
  const budgetMap = new Map<number, Map<string, number>>();
  for (const b of budgets ?? []) {
    const bb = b as { branch_id: number; category: string | null; amount: number };
    if (!budgetMap.has(bb.branch_id)) budgetMap.set(bb.branch_id, new Map());
    budgetMap.get(bb.branch_id)!.set(bb.category ?? "", Number(bb.amount));
  }

  // Sarflangan (bu oy) — filial va filial+kategoriya bo'yicha + lavozim
  const spentMap = new Map<number, number>();
  const spentByRole = new Map<string, number>();
  for (const r of reports ?? []) {
    const rr = r as unknown as { total: number; created_at: string; request: { branch_id: number | null; creator: { role: string } | { role: string }[] | null } | null };
    if (!rr.created_at?.startsWith(month)) continue;
    const amt = rr.total || 0;
    if (rr.request?.branch_id) spentMap.set(rr.request.branch_id, (spentMap.get(rr.request.branch_id) ?? 0) + amt);
    const cr = rr.request?.creator;
    const role = Array.isArray(cr) ? cr[0]?.role : cr?.role;
    if (role) spentByRole.set(role, (spentByRole.get(role) ?? 0) + amt);
  }
  const spentByCat = new Map<string, number>(); // key `${branch}|${category}`
  for (const it of catItems ?? []) {
    const ii = it as unknown as { category: string | null; qty: number; price: number; report: { created_at: string; request: { branch_id: number | null } | null } | null };
    if (!ii.report?.created_at?.startsWith(month) || !ii.report.request?.branch_id || !ii.category) continue;
    const key = `${ii.report.request.branch_id}|${ii.category}`;
    spentByCat.set(key, (spentByCat.get(key) ?? 0) + (Number(ii.qty) || 0) * (Number(ii.price) || 0));
  }

  const committedMap = new Map<number, number>();
  for (const c of commits ?? []) {
    const cc = c as { branch_id: number | null; estimated_amount: number | null; limit_amount: number | null };
    if (!cc.branch_id) continue;
    committedMap.set(cc.branch_id, (committedMap.get(cc.branch_id) ?? 0) + Number(cc.limit_amount ?? cc.estimated_amount ?? 0));
  }

  let totBudget = 0, totSpent = 0, totCommitted = 0;
  for (const b of branches ?? []) {
    totBudget += Number(budgetMap.get(b.id)?.get("") ?? 0);
    totSpent += spentMap.get(b.id) ?? 0;
    totCommitted += committedMap.get(b.id) ?? 0;
  }
  const totRemaining = totBudget - totSpent - totCommitted;
  const branchOpts = (branches ?? []).map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Filial byudjeti</h1>
        <MonthFilter month={month} />
      </div>

      {/* Vositalar: nusxa / yillik / import (punkt 17, 20) */}
      <div className="flex flex-wrap gap-2">
        <form action={copyLastMonth}>
          <input type="hidden" name="month" value={month} />
          <button className="btn btn-ghost !py-1 text-sm">📋 O'tgan oydan nusxala</button>
        </form>
        <form action={applyAnnual}>
          <input type="hidden" name="month" value={month} />
          <button className="btn btn-ghost !py-1 text-sm">🗓 Butun yilga qo'llash</button>
        </form>
      </div>
      <BudgetImport branches={branchOpts} month={month} action={importBudgets} />

      {/* Umumiy (org) rollup */}
      <div className="card p-4">
        <div className="text-sm font-semibold mb-2">Umumiy (barcha filiallar)</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Stat label="Byudjet" value={formatMoney(totBudget)} />
          <Stat label="Sarflandi" value={formatMoney(totSpent)} />
          <Stat label="Majburiyat" value={formatMoney(totCommitted)} />
          <Stat label="Qoldiq" value={formatMoney(totRemaining)} danger={totRemaining < 0} />
        </div>
      </div>

      {/* Lavozim bo'yicha sarf */}
      {spentByRole.size > 0 && (
        <div className="card p-4">
          <div className="text-sm font-semibold mb-2">Lavozim bo'yicha sarf ({month})</div>
          <div className="space-y-1">
            {[...spentByRole.entries()].sort((a, b) => b[1] - a[1]).map(([role, amt]) => (
              <div key={role} className="flex justify-between text-sm">
                <span className="text-muted">{ROLES[role as Role] ?? role}</span>
                <span className="font-medium">{formatMoney(amt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filial bo'yicha */}
      <div className="space-y-2">
        {(branches ?? []).map((b) => {
          const cats = budgetMap.get(b.id) ?? new Map<string, number>();
          const budget = Number(cats.get("") ?? 0);
          const spent = spentMap.get(b.id) ?? 0;
          const committed = committedMap.get(b.id) ?? 0;
          const used = spent + committed;
          const pct = budget ? Math.round((used / budget) * 100) : 0;
          const remaining = budget - used;
          const over = budget > 0 && used > budget;
          const catBudgets = [...cats.entries()].filter(([c]) => c !== "");
          return (
            <div key={b.id} className="card p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="font-medium">{b.name}</div>
                <form action={saveBudget} className="flex items-center gap-2">
                  <input type="hidden" name="branch_id" value={b.id} />
                  <input type="hidden" name="month" value={month} />
                  <input type="hidden" name="category" value="" />
                  <input name="amount" type="number" defaultValue={budget || ""} placeholder="Byudjet"
                    className="input !py-1 w-36 text-sm" />
                  <button className="btn btn-ghost !py-1 text-sm">Saqlash</button>
                </form>
              </div>
              {budget > 0 && (
                <>
                  <div className="h-2 rounded-full bg-surface-2 overflow-hidden flex">
                    <div className={`h-full ${over ? "bg-danger" : "bg-brand"}`} style={{ width: `${Math.min((spent / budget) * 100, 100)}%` }} />
                    <div className="h-full bg-brand/40" style={{ width: `${Math.min((committed / budget) * 100, Math.max(0, 100 - (spent / budget) * 100))}%` }} />
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-4 text-xs mt-1">
                    <span className="text-muted">Sarflandi: {formatMoney(spent)}</span>
                    <span className="text-muted">Majburiyat: {formatMoney(committed)}</span>
                    <span className={over ? "text-danger font-semibold" : "text-muted"}>Qoldiq: {formatMoney(remaining)} ({pct}%)</span>
                  </div>
                  {isCurrentMonth && spent > 0 && elapsed > 0 && (() => {
                    const projected = Math.round(spent / elapsed);
                    const willOver = projected > budget;
                    return (
                      <div className={`text-xs mt-1 ${willOver ? "text-danger" : "text-muted"}`}>
                        Bu tezlikda oy oxiriga: {formatMoney(projected)} — {willOver ? "byudjetdan oshadi ⚠️" : "byudjetga sig'adi"}
                      </div>
                    );
                  })()}
                </>
              )}

              {/* Kategoriya byudjetlari (punkt 7) */}
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-brand">Kategoriya byudjetlari {catBudgets.length ? `(${catBudgets.length})` : ""}</summary>
                <div className="mt-2 space-y-2">
                  {catBudgets.map(([cat, amt]) => {
                    const cspent = spentByCat.get(`${b.id}|${cat}`) ?? 0;
                    const cover = amt > 0 && cspent > amt;
                    return (
                      <div key={cat} className="text-xs">
                        <div className="flex justify-between">
                          <span>{cat}</span>
                          <span className={cover ? "text-danger font-semibold" : "text-muted"}>{formatMoney(cspent)} / {formatMoney(amt)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden mt-0.5">
                          <div className={`h-full ${cover ? "bg-danger" : "bg-brand"}`} style={{ width: `${Math.min(amt ? (cspent / amt) * 100 : 0, 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  <form action={saveBudget} className="flex flex-wrap items-end gap-2 pt-1">
                    <input type="hidden" name="branch_id" value={b.id} />
                    <input type="hidden" name="month" value={month} />
                    <select name="category" className="select !py-1 text-xs flex-1 min-w-40">
                      {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input name="amount" type="number" placeholder="Summa" className="input !py-1 w-28 text-xs" />
                    <button className="btn btn-ghost !py-1 text-xs">+ Qo'shish</button>
                  </form>
                </div>
              </details>
            </div>
          );
        })}
        {(branches ?? []).length === 0 && <div className="card p-6 text-center text-muted text-sm">Filial yo'q.</div>}
      </div>
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className={`font-semibold ${danger ? "text-danger" : ""}`}>{value}</div>
    </div>
  );
}
