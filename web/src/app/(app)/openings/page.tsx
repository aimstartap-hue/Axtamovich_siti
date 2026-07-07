import { redirect } from "next/navigation";
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { formatDate } from "@/lib/workflow";
import { toSom, type Rates } from "@/lib/currency";
import { OPENING_STAGES, OPENING_ROLES } from "@/lib/constants";
import StatusBadge from "@/components/StatusBadge";
import ExportCsv from "@/components/ExportCsv";

const CLOSED = "closed";
const DEAD = ["closed", "rejected"];

function daysBetween(a: string, b: string) {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));
}

export default async function OpeningsPage() {
  const profile = await requireProfile();
  if (!OPENING_ROLES.includes(profile.role)) redirect("/");
  const sb = await createClient();

  const [{ data: reqs }, { data: rateRows }, { data: rejects }] = await Promise.all([
    sb.from("requests").select("id, title, status, estimated_amount, estimated_currency, rating, paid, paid_at, deadline, created_at, opening_stages, opening_project, reports(total, created_at)").eq("type", "new_branch").order("id", { ascending: false }),
    sb.from("exchange_rates").select("currency, rate"),
    sb.from("events").select("comment, created_at, request:requests(id, title, type)").eq("action", "Rad etdi").order("id", { ascending: false }).limit(50),
  ]);

  const rates: Rates = {};
  for (const r of rateRows ?? []) rates[(r as { currency: string }).currency] = (r as { rate: number }).rate;

  type Proj = {
    id: number; title: string; status: string; planned: number; actual: number;
    currency: string | null; rating: number | null; paid: boolean; days: number | null; created_at: string;
    stagePct: number; project: string | null;
  };
  const projects: Proj[] = (reqs ?? []).map((r) => {
    const rr = r as unknown as {
      id: number; title: string; status: string; estimated_amount: number | null; estimated_currency: string | null;
      rating: number | null; paid: boolean | null; created_at: string; reports: { total: number; created_at: string }[] | null;
      opening_stages: Record<string, boolean> | null; opening_project: string | null;
    };
    const planned = toSom(Number(rr.estimated_amount ?? 0), rr.estimated_currency, rates);
    const reps = rr.reports ?? [];
    const actual = reps.reduce((s, x) => s + (x.total || 0), 0);
    const lastRep = reps.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    const stagesDone = OPENING_STAGES.filter((s) => rr.opening_stages?.[s.key]).length;
    return {
      id: rr.id, title: rr.title, status: rr.status, planned, actual,
      currency: rr.estimated_currency, rating: rr.rating, paid: !!rr.paid,
      days: lastRep ? daysBetween(rr.created_at, lastRep.created_at) : null, created_at: rr.created_at,
      stagePct: Math.round((stagesDone / OPENING_STAGES.length) * 100), project: rr.opening_project,
    };
  });

  const active = projects.filter((p) => !DEAD.includes(p.status));
  const done = projects.filter((p) => p.status === CLOSED && p.actual > 0);
  const totalPlanned = active.reduce((s, p) => s + p.planned, 0);
  const totalSpent = done.reduce((s, p) => s + p.actual, 0);
  const avgCost = done.length ? Math.round(totalSpent / done.length) : 0;
  const avgDays = done.filter((p) => p.days != null).length
    ? Math.round(done.reduce((s, p) => s + (p.days ?? 0), 0) / done.filter((p) => p.days != null).length) : 0;

  // Ochilish rad sabablari (punkt 22) — faqat new_branch
  const openRejects = (rejects ?? []).map((e) => {
    const ee = e as unknown as { comment: string | null; created_at: string; request: { id: number; title: string; type: string } | { id: number; title: string; type: string }[] | null };
    const rq = Array.isArray(ee.request) ? ee.request[0] : ee.request;
    return { id: rq?.id, title: rq?.title ?? "—", type: rq?.type, comment: ee.comment, date: ee.created_at };
  }).filter((r) => r.type === "new_branch");

  // Solishtiruv/reyting (punkt 25) — yopilgan ochilishlar narx bo'yicha
  const ranking = [...done].sort((a, b) => a.actual - b.actual);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">🏗 Ochilish loyihalari</h1>

      {/* Rollup (punkt 10, 17) */}
      <div className="card p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Stat label="Faol loyihalar" value={String(active.length)} />
          <Stat label="Rejalashtirilgan" value={formatMoney(totalPlanned)} />
          <Stat label="O'rtacha ochilish narxi" value={formatMoney(avgCost)} />
          <Stat label="O'rtacha muddat" value={avgDays ? `${avgDays} kun` : "—"} />
        </div>
      </div>

      {/* Loyihalar ro'yxati + CSV (punkt 3, 5, 6, 7, 8, 21) */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Loyihalar</h2>
          <ExportCsv filename="ochilish-loyihalari"
            headers={["Loyiha", "Holat", "Reja", "Fakt", "Farq", "Kun"]}
            rows={projects.map((p) => [p.title, p.status, p.planned, p.actual, p.actual - p.planned, p.days ?? ""])} />
        </div>
        {projects.length === 0 ? <Empty text="Hali ochilish loyihasi yo'q." /> : (
          <div className="space-y-3">
            {projects.map((p) => {
              const diff = p.actual - p.planned;
              const over = diff > 0 && p.actual > 0;
              const pct = p.planned ? Math.min(Math.round((p.actual / p.planned) * 100), 100) : 0;
              return (
                <div key={p.id} className="border-t border-border pt-3 first:border-0 first:pt-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/requests/${p.id}`} className="font-medium text-brand">{p.title}</Link>
                      {p.project && <span className="text-xs bg-surface-2 rounded px-1.5 py-0.5 text-muted">🏷 {p.project}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {p.paid && <span className="text-xs text-success">✓ To'langan</span>}
                      <StatusBadge status={p.status} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs mt-1 text-muted">
                    <span>Reja: {formatMoney(p.planned)}{p.currency && p.currency !== "so'm" ? ` (${p.currency})` : ""}</span>
                    {p.actual > 0 && <span>Fakt: {formatMoney(p.actual)}</span>}
                    {p.actual > 0 && <span className={over ? "text-danger font-semibold" : "text-success font-semibold"}>Farq: {over ? "+" : ""}{formatMoney(diff)}</span>}
                    {!DEAD.includes(p.status) && <span>{p.stagePct}% bosqich</span>}
                    {p.days != null && <span>{p.days} kun</span>}
                    {p.rating ? <span>{"⭐".repeat(p.rating)}</span> : null}
                  </div>
                  {p.planned > 0 && p.actual > 0 && (
                    <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden mt-1">
                      <div className={`h-full ${over ? "bg-danger" : "bg-brand"}`} style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Solishtiruv/reyting (punkt 25) */}
      {ranking.length > 1 && (
        <div className="card p-4">
          <h2 className="font-semibold mb-3">Ochilishlar solishtiruvi (arzondan qimmatga)</h2>
          <div className="space-y-1">
            {ranking.map((p, i) => (
              <div key={p.id} className="flex justify-between text-sm">
                <span>{i + 1}. {p.title} {p.rating ? `· ${"⭐".repeat(p.rating)}` : ""}</span>
                <span className="font-medium">{formatMoney(p.actual)} {p.days != null ? `· ${p.days} kun` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rad sabablari (punkt 22) */}
      {openRejects.length > 0 && (
        <div className="card p-4">
          <h2 className="font-semibold mb-3">Rad etilgan ochilish so'rovlari</h2>
          <div className="space-y-2">
            {openRejects.map((r, i) => (
              <div key={i} className="flex flex-wrap justify-between gap-2 text-sm border-t border-border pt-2 first:border-0 first:pt-0">
                <Link href={`/requests/${r.id}`} className="text-brand">#{r.id} {r.title}</Link>
                <div className="text-right">
                  <div className={r.comment ? "" : "text-muted"}>{r.comment || "sabab yo'q"}</div>
                  <div className="text-xs text-muted">{formatDate(r.date)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="text-center text-muted text-sm py-4">{text}</div>;
}
