import { createClient } from "@/lib/supabase/server";
import { isOpen, isOverdue } from "@/lib/helpers";
import RegmenAnalytics, { type RegReq } from "./RegmenAnalytics";
import type { Profile, RequestRow } from "@/lib/types";

export default async function RegmenDashboard({ profile }: { profile: Profile }) {
  const sb = await createClient();

  // Faqat o'ziga biriktirilgan filiallar
  const { data: branches } = await sb.from("branches").select("id, name, status")
    .eq("regmen_id", profile.id).order("name");
  const branchIds = (branches ?? []).map((b) => b.id);

  if (branchIds.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Regional menejer</h1>
        <div className="card p-6 text-center text-muted text-sm">Sizga hali filial biriktirilmagan.</div>
      </div>
    );
  }

  const { data: reqs } = await sb.from("requests").select("*").in("branch_id", branchIds);
  const all = (reqs ?? []) as RequestRow[];
  const openCount = all.filter((r) => isOpen(r.status)).length;
  const overdue = all.filter((r) => isOverdue(r)).length;

  const list: RegReq[] = all.map((r) => ({
    id: r.id, title: r.title, status: r.status, branch_id: r.branch_id,
    deadline: r.deadline, created_at: r.created_at, priority: r.priority,
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Regional menejer</h1>
          <p className="text-sm text-muted">{branches!.length} ta filial · {profile.full_name.split(" ")[0]}</p>
        </div>
        <div className="flex gap-2">
          <MiniStat label="Ochiq" value={openCount} color="text-warning" />
          <MiniStat label="Muddati o'tgan" value={overdue} color="text-danger" />
        </div>
      </div>

      <RegmenAnalytics branches={(branches ?? []).map((b) => ({ id: b.id, name: b.name }))} requests={list} />
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card px-4 py-2 text-center">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}
