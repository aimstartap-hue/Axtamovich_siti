import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { canView, needsAction } from "@/lib/workflow";
import { isOpen, isInProgress, isClosed } from "@/lib/helpers";
import RequestCard from "@/components/RequestCard";
import type { Profile, RequestRow } from "@/lib/types";

export default async function ManagerDashboard({ profile }: { profile: Profile }) {
  const sb = await createClient();
  const [{ data: reqs }, { data: ub }, { data: branch }] = await Promise.all([
    sb.from("requests").select("*").order("id", { ascending: false }),
    sb.from("user_branches").select("branch_id").eq("user_id", profile.id),
    profile.branch_id ? sb.from("branches").select("name").eq("id", profile.branch_id).single() : Promise.resolve({ data: null }),
  ]);
  const userBranchIds = (ub ?? []).map((x) => x.branch_id);
  const mine = ((reqs ?? []) as RequestRow[]).filter((r) => canView(r, profile, { userBranchIds }));

  const open = mine.filter((r) => isOpen(r.status) && !isInProgress(r.status));
  const inProgress = mine.filter((r) => isInProgress(r.status));
  const closed = mine.filter((r) => isClosed(r.status));
  const tasks = mine.filter((r) => needsAction(r, profile.role) || (r.status === "closed" && !r.rating && r.created_by === profile.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Salom, {profile.full_name.split(" ")[0] || profile.full_name}!</h1>
          <p className="text-sm text-muted">{branch?.name ?? "Filial menejeri"}</p>
        </div>
        <Link href="/requests/new" className="btn btn-brand">+ Yangi zayavka</Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Ochiq" value={open.length} color="text-warning" />
        <Stat label="Bajarilmoqda" value={inProgress.length} color="text-brand" />
        <Stat label="Yopilgan" value={closed.length} color="text-success" />
      </div>

      {tasks.length > 0 && (
        <Section title="Sizdan harakat talab qiladi">
          {tasks.map((r) => <RequestCard key={r.id} r={r} />)}
        </Section>
      )}

      <Section title="Bajarilmoqda" empty="Hozircha ish jarayonida zayavka yo'q.">
        {inProgress.map((r) => <RequestCard key={r.id} r={r} />)}
      </Section>

      <Section title="Ochiq zayavkalar" empty="Ochiq zayavka yo'q.">
        {open.map((r) => <RequestCard key={r.id} r={r} highlightNew />)}
      </Section>

      {closed.length > 0 && (
        <details className="card p-4">
          <summary className="cursor-pointer font-semibold">Yopilgan ({closed.length})</summary>
          <div className="space-y-2 mt-3">{closed.slice(0, 20).map((r) => <RequestCard key={r.id} r={r} />)}</div>
        </details>
      )}
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

function Section({ title, children, empty }: { title: string; children: React.ReactNode; empty?: string }) {
  const arr = Array.isArray(children) ? children : [children];
  const isEmpty = arr.flat().filter(Boolean).length === 0;
  return (
    <section>
      <h2 className="font-semibold mb-2">{title}</h2>
      {isEmpty && empty ? (
        <div className="card p-6 text-center text-muted text-sm">{empty}</div>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  );
}
