import { redirect } from "next/navigation";
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { formatDate } from "@/lib/workflow";
import { toSom, type Rates } from "@/lib/currency";
import { DEFAULT_CEO_THRESHOLD, CEO_ROLES } from "@/lib/constants";
import { isOpen, currentMonth } from "@/lib/helpers";
import StatusBadge from "@/components/StatusBadge";
import ExportCsv from "@/components/ExportCsv";

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export default async function CeoPage() {
  const profile = await requireProfile();
  if (!CEO_ROLES.includes(profile.role)) redirect("/");
  const sb = await createClient();
  const month = currentMonth();

  const [{ data: reqs }, { data: reports }, { data: items }, { data: budgets }, { data: branches }, { data: events }, { data: rateRows }, { data: audit }, { data: thr }] = await Promise.all([
    sb.from("requests").select("id, title, type, status, estimated_amount, estimated_currency, branch_id, created_by, executed_by, rating, paid, deadline, suggested_deadline, created_at"),
    sb.from("reports").select("total, created_at, request:requests(branch_id)"),
    sb.from("report_items").select("name, category, supplier, qty, price, report:reports(created_at)"),
    sb.from("budgets").select("branch_id, category, amount").eq("month", month),
    sb.from("branches").select("id, name"),
    sb.from("events").select("request_id, action, created_at").order("id"),
    sb.from("exchange_rates").select("currency, rate"),
    sb.from("audit_log").select("action, detail, created_at, actor:profiles(full_name)").order("id", { ascending: false }).limit(12),
    sb.from("org_settings").select("value").eq("key", "ceo_threshold").maybeSingle(),
  ]);

  const rates: Rates = {};
  for (const r of rateRows ?? []) rates[(r as { currency: string }).currency] = (r as { rate: number }).rate;
  const threshold = thr?.value ? parseFloat(thr.value) : DEFAULT_CEO_THRESHOLD;
  const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]));

  const all = (reqs ?? []) as {
    id: number; title: string; type: string; status: string; estimated_amount: number | null;
    estimated_currency: string | null; branch_id: number | null; created_by: string; executed_by: string | null;
    rating: number | null; paid: boolean | null; deadline: string | null; suggested_deadline: string | null; created_at: string;
  }[];
  const plannedSom = (r: { estimated_amount: number | null; estimated_currency: string | null }) =>
    toSom(Number(r.estimated_amount ?? 0), r.estimated_currency, rates);

  // --- KPI (21) + chegara (4) + rad % ---
  const pendingCeo = all.filter((r) => r.status === "pending_ceo").sort((a, b) => plannedSom(b) - plannedSom(a));
  const disputes = all.filter((r) => r.status === "deadline_dispute");
  const rejected = all.filter((r) => r.status === "rejected");
  const rejectPct = all.length ? Math.round((rejected.length / all.length) * 100) : 0;
  const overThreshold = all.filter((r) => plannedSom(r) > threshold).length;

  // Aylanish tezligi (20): yopilgan zayavka uchun created_at -> oxirgi event
  const evByReq = new Map<number, string[]>();
  for (const e of events ?? []) {
    const ee = e as { request_id: number; created_at: string };
    if (!evByReq.has(ee.request_id)) evByReq.set(ee.request_id, []);
    evByReq.get(ee.request_id)!.push(ee.created_at);
  }
  const closedReqs = all.filter((r) => r.status === "closed");
  const cycleDays = closedReqs.map((r) => {
    const evs = evByReq.get(r.id) ?? [];
    const last = evs.length ? evs[evs.length - 1] : r.created_at;
    return Math.max(0, Math.round((new Date(last).getTime() - new Date(r.created_at).getTime()) / 86_400_000));
  });
  const avgCycle = cycleDays.length ? Math.round(cycleDays.reduce((s, x) => s + x, 0) / cycleDays.length) : 0;

  // --- Korxona moliya (7) + valyuta (11) ---
  const spentThisMonth = new Map<number, number>();
  let totalSpent = 0;
  for (const r of reports ?? []) {
    const rr = r as unknown as { total: number; created_at: string; request: { branch_id: number | null } | null };
    if (!rr.created_at?.startsWith(month)) continue;
    totalSpent += rr.total || 0;
    if (rr.request?.branch_id) spentThisMonth.set(rr.request.branch_id, (spentThisMonth.get(rr.request.branch_id) ?? 0) + (rr.total || 0));
  }
  const budgetByBranch = new Map<number, number>();
  for (const b of budgets ?? []) {
    const bb = b as { branch_id: number; category: string | null; amount: number };
    if ((bb.category ?? "") === "") budgetByBranch.set(bb.branch_id, Number(bb.amount));
  }
  let totalBudget = 0; for (const v of budgetByBranch.values()) totalBudget += v;
  const committed = all.filter((r) => isOpen(r.status) && ["approved", "funded", "manager_doing", "axo_review"].includes(r.status))
    .reduce((s, r) => s + plannedSom(r), 0);
  const usdExposure = all.filter((r) => r.estimated_currency === "USD" && isOpen(r.status))
    .reduce((s, r) => s + Number(r.estimated_amount ?? 0), 0);

  // Filial reytingi (8, 23)
  const branchRank = (branches ?? []).map((b) => {
    const bud = budgetByBranch.get(b.id) ?? 0;
    const sp = spentThisMonth.get(b.id) ?? 0;
    return { name: b.name, bud, sp, pct: bud ? Math.round((sp / bud) * 100) : 0, over: bud > 0 && sp > bud };
  }).filter((x) => x.bud > 0 || x.sp > 0).sort((a, b) => b.pct - a.pct);
  const adherent = branchRank.filter((x) => x.bud > 0 && !x.over).length;
  const withBudget = branchRank.filter((x) => x.bud > 0).length;
  const adherencePct = withBudget ? Math.round((adherent / withBudget) * 100) : 0;

  // Ochilishlar (9)
  const openings = all.filter((r) => r.type === "new_branch");
  const openingsActive = openings.filter((r) => isOpen(r.status));

  // Katta ochiq xarajatlar (5)
  const bigOpen = all.filter((r) => isOpen(r.status) && plannedSom(r) > 0).sort((a, b) => plannedSom(b) - plannedSom(a)).slice(0, 8);

  // To'lanmagan yirik (19)
  const unpaidBig = all.filter((r) => r.status === "closed" && !r.paid && plannedSom(r) > 0).sort((a, b) => plannedSom(b) - plannedSom(a)).slice(0, 8);

  // Baholar (18)
  const rated = all.filter((r) => r.rating).slice(0, 8);

  // Delegatsiya (24)
  const delegated = all.filter((r) => r.executed_by === "manager" || r.status === "manager_doing" || r.status === "axo_review");

  // Narx sakrashlari (16): bir xil mahsulot 30%+ qimmatlashsa
  const byItem = new Map<string, { price: number; date: string }[]>();
  for (const it of items ?? []) {
    const ii = it as unknown as { name: string; category: string | null; price: number; report: { created_at: string } | null };
    const key = `${norm(ii.name)}|${norm(ii.category)}`;
    if (!byItem.has(key)) byItem.set(key, []);
    byItem.get(key)!.push({ price: Number(ii.price) || 0, date: ii.report?.created_at ?? "" });
  }
  const spikes: { name: string; prev: number; curr: number; pct: number }[] = [];
  for (const it of items ?? []) {
    const ii = it as unknown as { name: string; category: string | null };
    const key = `${norm(ii.name)}|${norm(ii.category)}`;
    const arr = (byItem.get(key) ?? []).filter((x) => x.date).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (arr.length >= 2) {
      const prev = arr[arr.length - 2].price, curr = arr[arr.length - 1].price;
      if (prev > 0 && curr > prev * 1.3 && !spikes.find((s) => s.name === ii.name)) {
        spikes.push({ name: ii.name, prev, curr, pct: Math.round(((curr - prev) / prev) * 100) });
      }
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">👔 CEO paneli</h1>

      {/* KPI (21, 4) */}
      <div className="card p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          <Stat label="Tasdiq kutmoqda" value={String(pendingCeo.length)} accent={pendingCeo.length > 0} />
          <Stat label="O'rtacha aylanish" value={avgCycle ? `${avgCycle} kun` : "—"} />
          <Stat label="Rad etilgan" value={`${rejectPct}%`} />
          <Stat label="Byudjet rioyasi" value={`${adherencePct}%`} />
          <Stat label="Chegaradan oshgan" value={String(overThreshold)} />
        </div>
      </div>

      {/* Korxona moliya (7, 11) */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Korxona moliyasi ({month})</h2>
          <Link href="/analytics" className="text-xs text-brand">Batafsil →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Stat label="Umumiy byudjet" value={formatMoney(totalBudget)} />
          <Stat label="Sarflandi" value={formatMoney(totalSpent)} />
          <Stat label="Majburiyat" value={formatMoney(committed)} />
          <Stat label="USD ta'siri" value={usdExposure ? `$${usdExposure.toLocaleString("ru-RU")}` : "—"} />
        </div>
      </div>

      {/* Tasdiq paneli (1, 2, 3) */}
      <Section title="Tasdiq kutayotgan (CEO)" link="/requests?status=pending_ceo">
        {pendingCeo.length === 0 ? <Empty text="Tasdiq kutayotgan zayavka yo'q." /> :
          pendingCeo.map((r) => <Row key={r.id} id={r.id} title={r.title} status={r.status}
            right={formatMoney(plannedSom(r))} sub={r.branch_id ? branchName.get(r.branch_id) : "Ochilish"} />)}
      </Section>

      {/* Muddat nizolari (6) */}
      {disputes.length > 0 && (
        <Section title="Muddat nizolari (hal qiling)" link="/requests?status=deadline_dispute">
          {disputes.map((r) => <Row key={r.id} id={r.id} title={r.title} status={r.status}
            right={r.suggested_deadline ? formatDate(r.suggested_deadline) : "—"} />)}
        </Section>
      )}

      {/* Katta ochiq xarajatlar (5) */}
      <Section title="Eng katta ochiq xarajatlar"
        action={<ExportCsv filename="katta-xarajatlar" headers={["Zayavka", "Holat", "Summa"]}
          rows={bigOpen.map((r) => [r.title, r.status, plannedSom(r)])} />}>
        {bigOpen.length === 0 ? <Empty text="Yo'q." /> :
          bigOpen.map((r) => <Row key={r.id} id={r.id} title={r.title} status={r.status} right={formatMoney(plannedSom(r))} />)}
      </Section>

      {/* Filial reytingi (8, 23) */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Filial reytingi (byudjet rioyasi)</h2>
          <Link href="/budgets" className="text-xs text-brand">Byudjet →</Link>
        </div>
        {branchRank.length === 0 ? <Empty text="Ma'lumot yo'q." /> : (
          <div className="space-y-1">
            {branchRank.slice(0, 10).map((b) => (
              <div key={b.name} className="flex justify-between text-sm">
                <span>{b.name}</span>
                <span className={b.over ? "text-danger font-semibold" : "text-muted"}>{formatMoney(b.sp)} / {formatMoney(b.bud)} ({b.pct}%)</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ochilishlar (9) */}
      <div className="card p-4 flex items-center justify-between">
        <div>
          <div className="font-semibold">Ochilish loyihalari</div>
          <div className="text-sm text-muted">{openingsActive.length} faol · {openings.length} jami</div>
        </div>
        <Link href="/openings" className="btn btn-ghost !py-1 text-sm">Batafsil →</Link>
      </div>

      {/* Narx sakrashlari (16) */}
      {spikes.length > 0 && (
        <div className="card p-4 border-amber-400/40">
          <h2 className="font-semibold mb-3">⚠️ Narx sakrashlari (30%+)</h2>
          <div className="space-y-1">
            {spikes.slice(0, 8).map((s, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>{s.name}</span>
                <span className="text-danger font-semibold">{formatMoney(s.prev)} → {formatMoney(s.curr)} (+{s.pct}%)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* To'lanmagan yirik (19) */}
      {unpaidBig.length > 0 && (
        <Section title="To'lanmagan yirik xarajatlar">
          {unpaidBig.map((r) => <Row key={r.id} id={r.id} title={r.title} status={r.status} right={formatMoney(plannedSom(r))} />)}
        </Section>
      )}

      {/* Delegatsiya (24) */}
      {delegated.length > 0 && (
        <Section title="Menejerga topshirilgan ishlar">
          {delegated.slice(0, 8).map((r) => <Row key={r.id} id={r.id} title={r.title} status={r.status}
            sub={r.branch_id ? branchName.get(r.branch_id) : ""} right={r.executed_by === "manager" ? "Menejer" : ""} />)}
        </Section>
      )}

      {/* Baholar (18) */}
      {rated.length > 0 && (
        <Section title="So'nggi baholar">
          {rated.map((r) => <Row key={r.id} id={r.id} title={r.title} status={r.status} right={"⭐".repeat(r.rating!)} />)}
        </Section>
      )}

      {/* Audit (17) */}
      {(audit ?? []).length > 0 && (
        <div className="card p-4">
          <h2 className="font-semibold mb-3">O'zgarishlar auditi</h2>
          <div className="space-y-2">
            {(audit ?? []).map((a, i) => {
              const aa = a as unknown as { action: string; detail: string | null; created_at: string; actor: { full_name: string } | { full_name: string }[] | null };
              const actor = Array.isArray(aa.actor) ? aa.actor[0] : aa.actor;
              return (
                <div key={i} className="flex flex-wrap justify-between gap-2 text-sm border-t border-border pt-2 first:border-0 first:pt-0">
                  <span>{aa.detail || aa.action}</span>
                  <span className="text-xs text-muted">{actor?.full_name ?? "—"} · {formatDate(aa.created_at)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className={`font-semibold ${accent ? "text-brand" : ""}`}>{value}</div>
    </div>
  );
}

function Section({ title, link, action, children }: { title: string; link?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">{title}</h2>
        {action ?? (link && <Link href={link} className="text-xs text-brand">Barchasi →</Link>)}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ id, title, status, right, sub }: { id: number; title: string; status: string; right?: string; sub?: string | null }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm border-t border-border pt-2 first:border-0 first:pt-0">
      <div className="flex items-center gap-2 min-w-0">
        <Link href={`/requests/${id}`} className="text-brand truncate">{title}</Link>
        {sub && <span className="text-xs text-muted">· {sub}</span>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {right && <span className="font-medium">{right}</span>}
        <StatusBadge status={status} />
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-center text-muted text-sm py-3">{text}</div>;
}
