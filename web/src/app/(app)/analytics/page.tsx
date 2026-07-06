import { redirect } from "next/navigation";
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { formatDate } from "@/lib/workflow";
import ExportCsv from "@/components/ExportCsv";

const FINANCE_ROLES = ["admin", "oper", "ceo", "finance", "ops_director"];

function monthLabel(m: string) {
  const [y, mo] = m.split("-");
  const names = ["", "Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"];
  return `${names[Number(mo)] ?? mo} ${y?.slice(2)}`;
}

export default async function AnalyticsPage() {
  const profile = await requireProfile();
  if (!FINANCE_ROLES.includes(profile.role)) redirect("/");
  const sb = await createClient();

  const [{ data: items }, { data: reports }, { data: rejects }] = await Promise.all([
    sb.from("report_items").select("category, supplier, qty, price"),
    sb.from("reports").select("total, created_at"),
    sb.from("events").select("comment, created_at, request:requests(id, title)").eq("action", "Rad etdi").order("id", { ascending: false }).limit(30),
  ]);

  // Kategoriya bo'yicha sarf (punkt 10)
  const byCat = new Map<string, number>();
  const bySup = new Map<string, number>();
  for (const it of items ?? []) {
    const r = it as { category: string | null; supplier: string | null; qty: number; price: number };
    const amt = (Number(r.qty) || 0) * (Number(r.price) || 0);
    if (r.category) byCat.set(r.category, (byCat.get(r.category) ?? 0) + amt);
    if (r.supplier?.trim()) bySup.set(r.supplier.trim(), (bySup.get(r.supplier.trim()) ?? 0) + amt);
  }
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  const sups = [...bySup.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const catMax = cats[0]?.[1] || 1;
  const supMax = sups[0]?.[1] || 1;

  // Oylik trend (punkt 12)
  const byMonth = new Map<string, number>();
  for (const r of reports ?? []) {
    const rr = r as { total: number; created_at: string };
    const m = rr.created_at?.slice(0, 7);
    if (m) byMonth.set(m, (byMonth.get(m) ?? 0) + (rr.total || 0));
  }
  const months = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
  const monMax = Math.max(1, ...months.map((m) => m[1]));

  const rejList = (rejects ?? []).map((e) => {
    const ee = e as unknown as { comment: string | null; created_at: string; request: { id: number; title: string } | { id: number; title: string }[] | null };
    const rq = Array.isArray(ee.request) ? ee.request[0] : ee.request;
    return { id: rq?.id, title: rq?.title ?? "—", comment: ee.comment, date: ee.created_at };
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Moliya analitikasi</h1>

      {/* Kategoriya bo'yicha sarf (10) + CSV (14) */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Kategoriya bo'yicha sarf</h2>
          <ExportCsv filename="kategoriya-sarf" headers={["Kategoriya", "Summa"]} rows={cats.map(([c, v]) => [c, v])} />
        </div>
        {cats.length === 0 ? <Empty /> : (
          <div className="space-y-2">
            {cats.map(([c, v]) => <Bar key={c} label={c} value={v} max={catMax} />)}
          </div>
        )}
      </div>

      {/* Top ta'minotchilar (11) */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Top ta'minotchilar</h2>
          <ExportCsv filename="taminotchi-sarf" headers={["Ta'minotchi", "Summa"]} rows={sups.map(([s, v]) => [s, v])} />
        </div>
        {sups.length === 0 ? <Empty text="Hisobotда ta'minotchi ko'rsatilmagan." /> : (
          <div className="space-y-2">
            {sups.map(([s, v]) => <Bar key={s} label={s} value={v} max={supMax} color="bg-violet-500" />)}
          </div>
        )}
      </div>

      {/* Oylik trend (12) */}
      <div className="card p-4">
        <h2 className="font-semibold mb-3">Oylik sarf trendi</h2>
        {months.length === 0 ? <Empty /> : (
          <div className="flex items-end gap-2 h-40">
            {months.map(([m, v]) => (
              <div key={m} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <div className="text-[10px] text-muted truncate w-full text-center">{formatMoney(v).replace(" so'm", "")}</div>
                <div className="w-full bg-brand rounded-t" style={{ height: `${Math.max(4, (v / monMax) * 100)}%` }} />
                <div className="text-[10px] text-muted">{monthLabel(m)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rad etilgan sabablari (25) */}
      <div className="card p-4">
        <h2 className="font-semibold mb-3">Rad etilgan zayavkalar sabablari</h2>
        {rejList.length === 0 ? <Empty text="Rad etilgan zayavka yo'q." /> : (
          <div className="space-y-2">
            {rejList.map((r, i) => (
              <div key={i} className="flex flex-wrap justify-between gap-2 text-sm border-t border-border pt-2 first:border-0 first:pt-0">
                <Link href={`/requests/${r.id}`} className="text-brand">#{r.id} {r.title}</Link>
                <div className="text-right">
                  <div className={r.comment ? "" : "text-muted"}>{r.comment || "sabab yozilmagan"}</div>
                  <div className="text-xs text-muted">{formatDate(r.date)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Bar({ label, value, max, color = "bg-brand" }: { label: string; value: number; max: number; color?: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-0.5">
        <span className="truncate mr-2">{label}</span>
        <span className="text-muted shrink-0">{formatMoney(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.max(2, (value / max) * 100)}%` }} />
      </div>
    </div>
  );
}

function Empty({ text = "Ma'lumot yo'q." }: { text?: string }) {
  return <div className="text-center text-muted text-sm py-4">{text}</div>;
}
