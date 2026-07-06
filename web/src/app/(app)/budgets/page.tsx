import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { ROLES, type Role } from "@/lib/constants";
import MonthFilter from "@/components/MonthFilter";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Tasdiqlangan lekin hali hisobot berilmagan (majburiyat) statuslari
const COMMITTED_STATUSES = ["approved", "funded", "manager_doing", "axo_review"];

async function saveBudget(formData: FormData) {
  "use server";
  const profile = await requireProfile();
  const sb = await createClient();
  const branch_id = Number(formData.get("branch_id"));
  const month = String(formData.get("month") || currentMonth());
  const amount = Number(formData.get("amount") || 0);
  await sb.from("budgets").upsert(
    { org_id: profile.org_id, branch_id, month, amount },
    { onConflict: "branch_id,month" },
  );
  revalidatePath("/budgets");
}

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireProfile();
  const sp = await searchParams;
  const month = sp.month || currentMonth();
  const sb = await createClient();

  // Sarf tezligi (burn rate) prognozi uchun — oyning qancha qismi o'tgani (punkt 23)
  const now = new Date();
  const isCurrentMonth = month === currentMonth();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const elapsed = isCurrentMonth ? now.getDate() / daysInMonth : 1;

  const [{ data: branches }, { data: budgets }, { data: reports }, { data: commits }] = await Promise.all([
    sb.from("branches").select("id, name").order("name"),
    sb.from("budgets").select("*").eq("month", month),
    sb.from("reports").select("total, created_at, request:requests(branch_id, created_by, creator:profiles!created_by(role))"),
    sb.from("requests").select("branch_id, estimated_amount, limit_amount").in("status", COMMITTED_STATUSES),
  ]);

  const budgetMap = new Map((budgets ?? []).map((b) => [b.branch_id, b.amount]));

  // Sarflangan (bu oy, filial bo'yicha) + lavozim bo'yicha
  const spentMap = new Map<number, number>();
  const spentByRole = new Map<string, number>();
  for (const r of reports ?? []) {
    const rr = r as unknown as {
      total: number; created_at: string;
      request: { branch_id: number | null; creator: { role: string } | { role: string }[] | null } | null;
    };
    if (!rr.created_at?.startsWith(month)) continue;
    const amt = rr.total || 0;
    if (rr.request?.branch_id) spentMap.set(rr.request.branch_id, (spentMap.get(rr.request.branch_id) ?? 0) + amt);
    const cr = rr.request?.creator;
    const role = Array.isArray(cr) ? cr[0]?.role : cr?.role;
    if (role) spentByRole.set(role, (spentByRole.get(role) ?? 0) + amt);
  }

  // Majburiyat (tasdiqlangan, hali sarflanmagan) — filial bo'yicha
  const committedMap = new Map<number, number>();
  for (const c of commits ?? []) {
    const cc = c as { branch_id: number | null; estimated_amount: number | null; limit_amount: number | null };
    if (!cc.branch_id) continue;
    committedMap.set(cc.branch_id, (committedMap.get(cc.branch_id) ?? 0) + Number(cc.limit_amount ?? cc.estimated_amount ?? 0));
  }

  // Umumiy (org) rollup
  let totBudget = 0, totSpent = 0, totCommitted = 0;
  for (const b of branches ?? []) {
    totBudget += Number(budgetMap.get(b.id) ?? 0);
    totSpent += spentMap.get(b.id) ?? 0;
    totCommitted += committedMap.get(b.id) ?? 0;
  }
  const totRemaining = totBudget - totSpent - totCommitted;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Filial byudjeti</h1>
        <MonthFilter month={month} />
      </div>

      {/* Umumiy (org) rollup — punkt 8 */}
      <div className="card p-4">
        <div className="text-sm font-semibold mb-2">Umumiy (barcha filiallar)</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Stat label="Byudjet" value={formatMoney(totBudget)} />
          <Stat label="Sarflandi" value={formatMoney(totSpent)} />
          <Stat label="Majburiyat" value={formatMoney(totCommitted)} />
          <Stat label="Qoldiq" value={formatMoney(totRemaining)} danger={totRemaining < 0} />
        </div>
      </div>

      {/* Lavozim (rol) bo'yicha sarf — punkt 8 */}
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
          const budget = Number(budgetMap.get(b.id) ?? 0);
          const spent = spentMap.get(b.id) ?? 0;
          const committed = committedMap.get(b.id) ?? 0;
          const used = spent + committed;
          const pct = budget ? Math.round((used / budget) * 100) : 0;
          const remaining = budget - used;
          const over = budget > 0 && used > budget;
          return (
            <div key={b.id} className="card p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="font-medium">{b.name}</div>
                <form action={saveBudget} className="flex items-center gap-2">
                  <input type="hidden" name="branch_id" value={b.id} />
                  <input type="hidden" name="month" value={month} />
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
                    <span className={over ? "text-danger font-semibold" : "text-muted"}>
                      Qoldiq: {formatMoney(remaining)} ({pct}%)
                    </span>
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
