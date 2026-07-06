import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { needsAction } from "@/lib/workflow";
import { isOpen } from "@/lib/helpers";
import RequestCard from "@/components/RequestCard";
import ManagerDashboard from "@/components/dashboards/ManagerDashboard";
import RegmenDashboard from "@/components/dashboards/RegmenDashboard";
import AxoDashboard from "@/components/dashboards/AxoDashboard";
import type { RequestRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const profile = await requireProfile();

  // Rolga qarab alohida dashboard
  if (profile.role === "branch_manager") return <ManagerDashboard profile={profile} />;
  if (profile.role === "regmen") return <RegmenDashboard profile={profile} />;
  if (profile.role === "axo") return <AxoDashboard profile={profile} />;
  return <GenericDashboard profile={profile} />;
}

// CEO / Moliya / admin / oper / open_group / hr — umumiy ko'rinish
async function GenericDashboard({ profile }: { profile: Awaited<ReturnType<typeof requireProfile>> }) {
  const sb = await createClient();
  const { data: reqs } = await sb
    .from("requests")
    .select("*")
    .order("id", { ascending: false });

  const all = (reqs ?? []) as RequestRow[];
  const myTasks = all.filter((r) => needsAction(r, profile.role));
  const open = all.filter((r) => isOpen(r.status));

  const stats = [
    { label: "Jami zayavka", value: all.length, color: "text-brand" },
    { label: "Ochiq", value: open.length, color: "text-warning" },
    { label: "Sizdan harakat", value: myTasks.length, color: "text-danger" },
    { label: "Yopilgan", value: all.filter((r) => r.status === "closed").length, color: "text-success" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Salom, {profile.full_name.split(" ")[0] || profile.full_name}!</h1>
          <p className="text-sm text-muted">Umumiy holat</p>
        </div>
        <Link href="/requests/new" className="btn btn-brand">+ Yangi zayavka</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <section>
        <h2 className="font-semibold mb-2">Sizdan harakat talab qiladi</h2>
        {myTasks.length === 0 ? (
          <div className="card p-6 text-center text-muted text-sm">Hozircha sizdan harakat talab qilinmaydi ✅</div>
        ) : (
          <div className="space-y-2">{myTasks.map((r) => <RequestCard key={r.id} r={r} />)}</div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">So'nggi zayavkalar</h2>
          <Link href="/requests" className="text-sm text-brand">Barchasi →</Link>
        </div>
        <div className="space-y-2">
          {all.slice(0, 8).map((r) => <RequestCard key={r.id} r={r} />)}
          {all.length === 0 && <div className="card p-6 text-center text-muted text-sm">Hali zayavka yo'q.</div>}
        </div>
      </section>
    </div>
  );
}
