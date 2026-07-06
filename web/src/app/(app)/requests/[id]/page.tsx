import { notFound } from "next/navigation";
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { REQUEST_TYPES, ROLES, type Role } from "@/lib/constants";
import { formatDate, formatMoney, NOTIFY_ROLES } from "@/lib/workflow";
import { isClosed } from "@/lib/helpers";
import StatusBadge from "@/components/StatusBadge";
import PriorityBadge from "@/components/PriorityBadge";
import StatusTimeline from "@/components/StatusTimeline";
import type { RequestRow } from "@/lib/types";
import ActionPanel from "./ActionPanel";
import CommentBox from "./CommentBox";
import RatingBox from "./RatingBox";
import { duplicateRequestAction } from "../actions";

export default async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rid = Number(id);
  const profile = await requireProfile();
  const sb = await createClient();

  const { data: r } = await sb.from("requests").select("*").eq("id", rid).single();
  if (!r) notFound();
  const req = r as RequestRow;

  const [{ data: branch }, { data: creator }, { data: events }, { data: comments }, { data: report }] =
    await Promise.all([
      req.branch_id ? sb.from("branches").select("name, status, regmen:regmen_id(full_name)").eq("id", req.branch_id).single() : Promise.resolve({ data: null }),
      sb.from("profiles").select("full_name, role").eq("id", req.created_by).single(),
      sb.from("events").select("*").eq("request_id", rid).order("id"),
      sb.from("comments").select("*, author:profiles(full_name)").eq("request_id", rid).order("id"),
      sb.from("reports").select("*, items:report_items(*)").eq("request_id", rid).order("id", { ascending: false }).limit(1).maybeSingle(),
    ]);

  // Byudjet konteksti — moliya tasdiqlaganда qoldiqni ko'rsatish uchun (punkt 1)
  let budgetInfo: { amount: number; spent: number; committed: number } | null = null;
  if (req.branch_id && req.status === "pending_finance") {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const [{ data: bud }, { data: reps }, { data: commits }] = await Promise.all([
      sb.from("budgets").select("amount").eq("branch_id", req.branch_id).eq("month", month).maybeSingle(),
      sb.from("reports").select("total, created_at, request:requests(branch_id)"),
      sb.from("requests").select("estimated_amount, limit_amount")
        .eq("branch_id", req.branch_id).in("status", ["approved", "funded", "manager_doing", "axo_review"]),
    ]);
    const spent = (reps ?? []).reduce((s, x) => {
      const rr = x as unknown as { total: number; created_at: string; request: { branch_id: number } | null };
      if (rr.request?.branch_id === req.branch_id && rr.created_at?.startsWith(month)) return s + (rr.total || 0);
      return s;
    }, 0);
    const committed = (commits ?? []).reduce((s, x) => {
      const c = x as { estimated_amount: number | null; limit_amount: number | null };
      return s + Number(c.limit_amount ?? c.estimated_amount ?? 0);
    }, 0);
    budgetInfo = { amount: Number(bud?.amount ?? 0), spent, committed };
  }

  const photos: string[] = Array.isArray(req.photos_json) ? req.photos_json : [];

  // Filial regmeni (embed massiv yoki obyekt bo'lishi mumkin)
  const regmenRaw = (branch as { regmen?: { full_name: string } | { full_name: string }[] } | null)?.regmen;
  const regmenName = Array.isArray(regmenRaw) ? regmenRaw[0]?.full_name : regmenRaw?.full_name;

  // Hozir kim javobgar (status -> rol)
  const respRoles = NOTIFY_ROLES[req.status] ?? [];
  const responsible = respRoles.map((r) => ROLES[r as Role]).join(", ");

  const isMine = req.created_by === profile.id;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Link href="/requests" className="text-sm text-brand">← Zayavkalar</Link>

      {/* Sarlavha */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-muted">#{req.id} · {REQUEST_TYPES[req.type]}</div>
            <h1 className="text-xl font-bold mt-1">{req.title}</h1>
          </div>
          <div className="flex flex-col items-end gap-1">
            <StatusBadge status={req.status} />
            <PriorityBadge priority={req.priority} />
          </div>
        </div>

        {/* Jarayon vizuali */}
        <div className="mt-4">
          <StatusTimeline type={req.type} status={req.status} />
        </div>

        {/* Hozir kimda (javobgar) */}
        {responsible && (
          <div className="mt-3 text-sm bg-surface-2 rounded-lg px-3 py-2">
            Hozir: <span className="font-semibold">{responsible}</span> da
          </div>
        )}

        {req.description && <p className="text-sm mt-3 whitespace-pre-wrap">{req.description}</p>}

        <dl className="grid grid-cols-2 gap-3 mt-4 text-sm">
          {branch && <Info label="Filial" value={branch.name} />}
          {regmenName && <Info label="Regional menejer" value={regmenName} />}
          <Info label="Yaratdi" value={creator?.full_name ?? "—"} />
          <Info label="Sana" value={formatDate(req.created_at)} />
          {req.deadline && <Info label="Muddat" value={formatDate(req.deadline)} />}
          {req.estimated_amount != null && <Info label="AXO bahosi" value={formatMoney(req.estimated_amount, req.estimated_currency ?? "so'm")} />}
          {req.limit_amount != null && <Info label="Limit" value={formatMoney(req.limit_amount)} />}
          {req.executed_by && <Info label="Bajardi" value={req.executed_by === "manager" ? "Filial menejeri" : "AXO"} />}
        </dl>

        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {photos.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <a key={i} href={u} target="_blank" rel="noreferrer">
                <img src={u} alt="" className="w-24 h-24 object-cover rounded-lg border border-border" />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Amallar */}
      <ActionPanel req={req} profile={profile} budget={budgetInfo} />

      {/* Baho (yopilgach, yaratgan menejer) + takrorlash */}
      {(isMine || isClosed(req.status)) && (
        <div className="card p-5 flex flex-wrap items-center justify-between gap-3">
          {isClosed(req.status) && isMine ? (
            <RatingBox requestId={req.id} current={req.rating} />
          ) : <span className="text-sm text-muted">Bu zayavka {isMine ? "siznikí" : ""}</span>}
          {isMine && (
            <form action={duplicateRequestAction}>
              <input type="hidden" name="id" value={req.id} />
              <button className="btn btn-ghost">↺ Takrorlash</button>
            </form>
          )}
        </div>
      )}

      {/* Hisobot */}
      {report && (
        <div className="card p-5">
          <h2 className="font-semibold mb-2">Foto-hisobot</h2>
          {report.note && <p className="text-sm mb-3">{report.note}</p>}
          {report.items?.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted text-xs text-left">
                  <tr><th className="py-1">Nomi</th><th>Kategoriya</th><th className="text-right">Soni</th><th className="text-right">Narx</th><th className="text-right">Jami</th></tr>
                </thead>
                <tbody>
                  {report.items.map((it: { id: number; name: string; category: string | null; qty: number; price: number }) => (
                    <tr key={it.id} className="border-t border-border">
                      <td className="py-1">{it.name}</td>
                      <td className="text-muted">{it.category ?? "—"}</td>
                      <td className="text-right">{it.qty}</td>
                      <td className="text-right">{formatMoney(it.price)}</td>
                      <td className="text-right">{formatMoney(it.qty * it.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="text-right font-semibold mt-2">Jami: {formatMoney(report.total)}</div>
        </div>
      )}

      {/* Tarix */}
      <div className="card p-5">
        <h2 className="font-semibold mb-3">Tarix</h2>
        <ol className="space-y-3">
          {(events ?? []).map((e) => (
            <li key={e.id} className="flex gap-3 text-sm">
              <div className="w-2 h-2 rounded-full bg-brand mt-1.5 shrink-0" />
              <div>
                <div className="font-medium">{e.action}</div>
                {e.comment && <div className="text-muted">{e.comment}</div>}
                <div className="text-xs text-muted">{formatDate(e.created_at)}</div>
              </div>
            </li>
          ))}
          {(events ?? []).length === 0 && <li className="text-sm text-muted">Tarix bo'sh.</li>}
        </ol>
      </div>

      {/* Izohlar */}
      <div className="card p-5">
        <h2 className="font-semibold mb-3">Izohlar</h2>
        <div className="space-y-3 mb-4">
          {(comments ?? []).map((c: { id: number; text: string; created_at: string; author: { full_name: string } | null }) => (
            <div key={c.id} className="text-sm">
              <span className="font-medium">{c.author?.full_name ?? "—"}</span>
              <span className="text-xs text-muted ml-2">{formatDate(c.created_at)}</span>
              <p className="whitespace-pre-wrap">{c.text}</p>
            </div>
          ))}
          {(comments ?? []).length === 0 && <p className="text-sm text-muted">Hali izoh yo'q.</p>}
        </div>
        <CommentBox requestId={req.id} />
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
