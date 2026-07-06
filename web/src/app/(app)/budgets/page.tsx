import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import MonthFilter from "@/components/MonthFilter";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

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

  const [{ data: branches }, { data: budgets }, { data: reports }] = await Promise.all([
    sb.from("branches").select("id, name").order("name"),
    sb.from("budgets").select("*").eq("month", month),
    sb.from("reports").select("total, created_at, request:requests(branch_id)"),
  ]);

  const budgetMap = new Map((budgets ?? []).map((b) => [b.branch_id, b.amount]));
  const spentMap = new Map<number, number>();
  for (const r of reports ?? []) {
    const rr = r as unknown as { total: number; created_at: string; request: { branch_id: number } | null };
    if (!rr.request?.branch_id) continue;
    if (!rr.created_at?.startsWith(month)) continue;
    spentMap.set(rr.request.branch_id, (spentMap.get(rr.request.branch_id) ?? 0) + (rr.total || 0));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Filial byudjeti</h1>
        <MonthFilter month={month} />
      </div>

      <div className="space-y-2">
        {(branches ?? []).map((b) => {
          const budget = Number(budgetMap.get(b.id) ?? 0);
          const spent = spentMap.get(b.id) ?? 0;
          const pct = budget ? Math.round((spent / budget) * 100) : 0;
          const over = budget > 0 && spent > budget;
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
                  <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                    <div className={`h-full ${over ? "bg-danger" : "bg-brand"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className={over ? "text-danger font-semibold" : "text-muted"}>
                      Sarflandi: {formatMoney(spent)} ({pct}%)
                    </span>
                    <span className="text-muted">Qoldiq: {formatMoney(budget - spent)}</span>
                  </div>
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
