import { createClient } from "@/lib/supabase/server";
import { canView } from "@/lib/workflow";
import { isOverdue } from "@/lib/helpers";
import RequestCard from "@/components/RequestCard";
import type { Profile, RequestRow } from "@/lib/types";

export default async function AxoDashboard({ profile }: { profile: Profile }) {
  const sb = await createClient();
  const [{ data: reqs }, { data: setting }, { data: branches }] = await Promise.all([
    sb.from("requests").select("id, type, title, status, created_at, deadline, priority, created_by, branch_id").eq("type", "maintenance").order("deadline", { ascending: true, nullsFirst: false }),
    sb.from("org_settings").select("value").eq("key", "axo_open_limit").maybeSingle(),
    sb.from("branches").select("id, name"),
  ]);
  const all = ((reqs ?? []) as RequestRow[]).filter((r) => canView(r, profile, {}));
  const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]));
  const limit = setting?.value ? parseInt(setting.value) : 5;

  const groups = {
    toEstimate: all.filter((r) => r.status === "pending_axo"),
    basket: all.filter((r) => r.status === "approved"),          // ochiq ochchot
    atManager: all.filter((r) => r.status === "manager_doing"),
    toReview: all.filter((r) => r.status === "axo_review"),
    waiting: all.filter((r) => ["pending_ceo", "pending_finance", "report_submitted"].includes(r.status)),
  };
  const openOchchot = groups.basket.length;
  const overCount = groups.basket.filter((r) => isOverdue(r)).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">AXO ish stoli</h1>
        <p className="text-sm text-muted">Salom, {profile.full_name.split(" ")[0]}!</p>
      </div>

      {/* Ochchot hisoblagichi */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={`card p-4 ${openOchchot >= limit ? "border-danger" : ""}`}>
          <div className={`text-2xl font-bold ${openOchchot >= limit ? "text-danger" : "text-brand"}`}>
            {openOchchot}/{limit}
          </div>
          <div className="text-xs text-muted mt-1">Ochiq ochchot {openOchchot >= limit && "(chegara!)"}</div>
        </div>
        <Stat label="Baholanadi" value={groups.toEstimate.length} color="text-warning" />
        <Stat label="Menejerda" value={groups.atManager.length} color="text-brand" />
        <Stat label="Muddati o'tgan" value={overCount} color="text-danger" />
      </div>

      <Section title="🆕 Yangi — baholanadi" hint="Narx va kategoriya kiriting" items={groups.toEstimate} branchName={branchName} />
      <Section title="🧰 Bajarilishi kerak (savat)" hint="Bajarib, foto-hisobot bering" items={groups.basket} branchName={branchName} />
      <Section title="🔎 Tekshirish — menejer hisoboti" items={groups.toReview} branchName={branchName} />
      <Section title="👷 Menejer bajarmoqda" items={groups.atManager} branchName={branchName} />
      <Section title="⏳ Tasdiq/hisobot kutilmoqda" items={groups.waiting} branchName={branchName} />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card p-4">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-muted mt-1">{label}</div>
    </div>
  );
}

function Section({ title, hint, items, branchName }: {
  title: string; hint?: string; items: RequestRow[]; branchName: Map<number, string>;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold">{title} <span className="text-muted font-normal">({items.length})</span></h2>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      <div className="space-y-2">
        {items.map((r) => <RequestCard key={r.id} r={r} branchName={r.branch_id ? branchName.get(r.branch_id) : null} />)}
      </div>
    </section>
  );
}
