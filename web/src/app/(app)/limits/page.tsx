import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/workflow";
import { logAudit } from "@/lib/audit";
import { ROLES, type Role } from "@/lib/constants";
import { currentMonth } from "@/lib/helpers";
import LimitForm from "@/components/LimitForm";

async function saveLimit(formData: FormData) {
  "use server";
  const profile = await requireProfile();
  const sb = await createClient();
  const scope = String(formData.get("scope"));
  const ref = String(formData.get("ref"));
  const amount = Number(formData.get("amount") || 0);
  if (!ref || !amount) return;
  await sb.from("limits").upsert(
    { org_id: profile.org_id, scope, ref, amount },
    { onConflict: "org_id,scope,ref" },
  );
  await logAudit(sb, profile.org_id, profile.id, "limit", `Limit (${scope}: ${ref}) = ${amount.toLocaleString("ru-RU")} so'm`);
  revalidatePath("/limits");
}

async function deleteLimit(formData: FormData) {
  "use server";
  await requireProfile();
  const sb = await createClient();
  await sb.from("limits").delete().eq("id", Number(formData.get("id")));
  revalidatePath("/limits");
}

export default async function LimitsPage() {
  await requireProfile();
  const month = currentMonth();
  const sb = await createClient();

  const [{ data: limits }, { data: reports }, { data: items }, { data: branches }, { data: users }] =
    await Promise.all([
      sb.from("limits").select("*").order("scope"),
      sb.from("reports").select("total, created_at, request:requests(branch_id, created_by, creator:profiles!created_by(role))"),
      sb.from("report_items").select("category, qty, price, report:reports(created_at)"),
      sb.from("branches").select("id, name"),
      sb.from("profiles").select("id, full_name, role"),
    ]);

  const branchName = new Map((branches ?? []).map((b) => [String(b.id), b.name]));
  const userName = new Map((users ?? []).map((u) => [u.id, u.full_name]));

  function spent(scope: string, ref: string): number {
    if (scope === "category") {
      return (items ?? []).reduce((s, it) => {
        const r = it as unknown as { category: string | null; qty: number; price: number; report: { created_at: string } | null };
        if (r.category === ref && r.report?.created_at?.startsWith(month)) return s + (r.qty || 0) * (r.price || 0);
        return s;
      }, 0);
    }
    return (reports ?? []).reduce((s, r) => {
      const rr = r as unknown as { total: number; created_at: string; request: { branch_id: number; created_by: string; creator: { role: string } | null } | null };
      if (!rr.created_at?.startsWith(month) || !rr.request) return s;
      if (scope === "branch" && String(rr.request.branch_id) === ref) return s + (rr.total || 0);
      if (scope === "user" && rr.request.created_by === ref) return s + (rr.total || 0);
      if (scope === "role" && rr.request.creator?.role === ref) return s + (rr.total || 0);
      return s;
    }, 0);
  }

  function refLabel(scope: string, ref: string): string {
    if (scope === "branch") return branchName.get(ref) ?? `#${ref}`;
    if (scope === "user") return userName.get(ref) ?? `#${ref}`;
    if (scope === "role") return ROLES[ref as Role] ?? ref;
    return ref;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Limitlar (oylik)</h1>
      <p className="text-sm text-muted">Joriy oy: {month}</p>

      <LimitForm
        action={saveLimit}
        branches={(branches ?? []).map((b) => ({ id: String(b.id), name: b.name }))}
        users={(users ?? []).map((u) => ({ id: u.id, name: u.full_name }))}
      />

      <div className="space-y-2">
        {(limits ?? []).map((l) => {
          const sp = spent(l.scope, l.ref);
          const pct = l.amount ? Math.round((sp / l.amount) * 100) : 0;
          const over = sp > l.amount;
          return (
            <div key={l.id} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium">{refLabel(l.scope, l.ref)} <span className="text-xs text-muted">({l.scope})</span></div>
                <form action={deleteLimit}>
                  <input type="hidden" name="id" value={l.id} />
                  <button className="btn btn-ghost !px-2 text-danger text-sm">🗑</button>
                </form>
              </div>
              <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                <div className={`h-full ${over ? "bg-danger" : "bg-brand"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className={over ? "text-danger font-semibold" : "text-muted"}>{formatMoney(sp)} / {formatMoney(l.amount)} ({pct}%)</span>
                {over && <span className="text-danger font-semibold">Limitdan oshdi!</span>}
              </div>
            </div>
          );
        })}
        {(limits ?? []).length === 0 && <div className="card p-6 text-center text-muted text-sm">Limit belgilanmagan.</div>}
      </div>
    </div>
  );
}
