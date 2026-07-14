import { notFound } from "next/navigation";
import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { REQUEST_TYPES, ROLES, FINANCE_ROLES, type Role } from "@/lib/constants";
import { formatDate, formatMoney, NOTIFY_ROLES } from "@/lib/workflow";
import { isClosed } from "@/lib/helpers";
import StatusBadge from "@/components/StatusBadge";
import PriorityBadge from "@/components/PriorityBadge";
import StatusTimeline from "@/components/StatusTimeline";
import type { RequestRow } from "@/lib/types";
import ActionPanel from "./ActionPanel";
import CommentBox from "./CommentBox";
import RatingBox from "./RatingBox";
import { duplicateRequestAction, markPaidAction } from "../actions";

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
  if (req.branch_id && (req.status === "pending_finance" || req.status === "pending_ceo")) {
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

  // --- Yangi filial so'rovi: workflow emas, o'qiladigan CHEK (smeta) ---
  if (req.type === "new_branch") {
    const estimate = Object.entries(req.opening_budget ?? {}) as [string, number][];
    const total = estimate.length ? estimate.reduce((s, [, v]) => s + Number(v), 0) : Number(req.estimated_amount ?? 0);
    const evs = (events ?? []) as { action: string; created_at: string }[];
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Link href="/requests" className="text-sm text-brand">← Zayavkalar</Link>

        {/* CHEK */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 16px 40px -24px rgba(0,0,0,.5)" }}>
          <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>Yangi filial so&apos;rovi · #{req.id}</div>
                <h1 className="text-xl font-bold mt-1 tracking-tight">{req.title}</h1>
              </div>
              <StatusBadge status={req.status} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
              {branch && <Info label="Filial" value={branch.name} />}
              <Info label="Yaratdi" value={creator?.full_name ?? "—"} />
              <Info label="Sana" value={formatDate(req.created_at)} />
              <Info label="Muhimlik" value={req.priority === "urgent" ? "Shoshilinch" : req.priority === "low" ? "Kam muhim" : "Oddiy"} />
            </div>
            {req.description && <p className="text-sm mt-3 whitespace-pre-wrap" style={{ color: "var(--muted)" }}>{req.description}</p>}
          </div>

          {/* Smeta */}
          {estimate.length > 0 && (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}><th className="font-medium px-6 pt-4 pb-2">Qurilish qismi</th><th className="font-medium px-6 pt-4 pb-2 text-right">Taxminiy summa</th></tr></thead>
              <tbody>
                {estimate.map(([part, amt]) => (
                  <tr key={part} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-6 py-2.5 font-medium">{part}</td>
                    <td className="px-6 py-2.5 text-right tabular-nums">{formatMoney(Number(amt))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="flex items-center justify-between px-6 py-4 border-t" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--brand) 8%, transparent)" }}>
            <span className="text-sm font-medium" style={{ color: "var(--muted)" }}>Jami taxminiy xarajat</span>
            <span className="text-2xl font-extrabold tabular-nums" style={{ color: "var(--brand)" }}>{formatMoney(total)}</span>
          </div>

          {photos.length > 0 && (
            <div className="flex flex-wrap gap-2 px-6 py-4 border-t" style={{ borderColor: "var(--border)" }}>
              {photos.map((u, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" className="w-20 h-20 object-cover rounded-lg border border-border" /></a>
              ))}
            </div>
          )}
        </div>

        {/* Tarix */}
        {evs.length > 0 && (
          <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <h2 className="text-sm font-semibold mb-3">Tarix</h2>
            <div className="space-y-2.5">
              {evs.map((e, i) => (
                <div key={i} className="flex items-start gap-2.5 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: "var(--brand)" }} />
                  <div><div>{e.action}</div><div className="text-xs" style={{ color: "var(--muted)" }}>{formatDate(e.created_at)}</div></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Narx benchmark (punkt 21) — faqat moliya/rahbariyatga ko'rinadi.
  // Bir xil mahsulotni (kategoriya + nom) oldin qanchaga olganini topib, % farqni ko'rsatadi.
  const financeView = FINANCE_ROLES.includes(profile.role);
  type Bench = { name: string; current: number; prev: number; prevDate: string; prevReq: number; deltaPct: number; bestPrice: number; bestSupplier: string | null };
  const priceBench: Bench[] = [];
  const reportItems = (report?.items ?? []) as { name: string; category: string | null; price: number }[];
  if (financeView && report && reportItems.length) {
    const { data: hist } = await sb.from("report_items").select("name, category, price, supplier, report:reports(created_at, request_id)");
    const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
    const reportDate = new Date(report.created_at).getTime();
    for (const it of reportItems) {
      const matches = (hist ?? [])
        .map((h) => h as unknown as { name: string; category: string | null; price: number; supplier: string | null; report: { created_at: string; request_id: number } | null })
        .filter((h) => h.report && h.report.request_id !== req.id
          && norm(h.name) === norm(it.name) && norm(h.category) === norm(it.category)
          && new Date(h.report.created_at).getTime() < reportDate);
      if (!matches.length) continue;
      matches.sort((a, b) => new Date(b.report!.created_at).getTime() - new Date(a.report!.created_at).getTime());
      const prev = matches[0];
      const deltaPct = prev.price ? Math.round(((it.price - prev.price) / prev.price) * 100) : 0;
      // Eng arzon tarixiy taklif (punkt 14 — ta'minotchi tavsiyasi)
      const cheapest = matches.reduce((m, x) => (x.price > 0 && x.price < m.price ? x : m), matches[0]);
      priceBench.push({
        name: it.name, current: it.price, prev: prev.price, prevDate: prev.report!.created_at,
        prevReq: prev.report!.request_id, deltaPct, bestPrice: cheapest.price, bestSupplier: cheapest.supplier,
      });
    }
  }

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

          {/* Reja vs Fakt — variance (punkt 6) */}
          {req.estimated_amount != null && (() => {
            const est = Number(req.estimated_amount);
            const diff = report.total - est;
            const pct = est ? Math.round((diff / est) * 100) : 0;
            const over = diff > 0;
            return (
              <div className="flex flex-wrap justify-between gap-x-4 text-xs mt-1 border-t border-border pt-2">
                <span className="text-muted">Reja (AXO): {formatMoney(est)}</span>
                <span className={over ? "text-danger font-semibold" : "text-success font-semibold"}>
                  Farq: {over ? "+" : ""}{formatMoney(diff)} ({over ? "+" : ""}{pct}%)
                </span>
              </div>
            );
          })()}

          {/* To'lov holati (punkt 16) */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm mt-3 border-t border-border pt-2">
            <span className="text-muted">To'lov holati:</span>
            {req.paid ? (
              <span className="text-success font-semibold">✓ To'langan {req.paid_at ? `· ${formatDate(req.paid_at)}` : ""}</span>
            ) : (
              <span className="text-muted">To'lanmagan</span>
            )}
            {financeView && (
              <form action={markPaidAction}>
                <input type="hidden" name="id" value={req.id} />
                <input type="hidden" name="paid" value={req.paid ? "0" : "1"} />
                <button className={`btn !py-1 text-xs ${req.paid ? "btn-ghost" : "btn-success"}`}>
                  {req.paid ? "Bekor qilish" : "To'langan deb belgilash"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Narx benchmark — faqat moliya/rahbariyat (punkt 21) */}
      {priceBench.length > 0 && (
        <div className="card p-5 border-amber-400/40">
          <h2 className="font-semibold mb-1">💰 Narx solishtiruvi <span className="text-xs text-muted font-normal">(faqat moliya)</span></h2>
          <p className="text-xs text-muted mb-3">Bu mahsulotlar oldin ham olingan — narx o'zgarishi:</p>
          <div className="space-y-2">
            {priceBench.map((b, i) => {
              const up = b.deltaPct > 0;
              return (
                <div key={i} className="flex flex-wrap items-center justify-between gap-2 text-sm border-t border-border pt-2 first:border-0 first:pt-0">
                  <div className="font-medium">{b.name}</div>
                  <div className="flex items-center gap-3 text-xs">
                    <Link href={`/requests/${b.prevReq}`} className="text-brand">
                      #{b.prevReq}: {formatMoney(b.prev)} ({formatDate(b.prevDate)})
                    </Link>
                    <span>→ {formatMoney(b.current)}</span>
                    <span className={`font-semibold ${up ? "text-danger" : b.deltaPct < 0 ? "text-success" : "text-muted"}`}>
                      {up ? "▲ +" : b.deltaPct < 0 ? "▼ " : ""}{b.deltaPct}% {up && b.deltaPct >= 30 ? "⚠️" : ""}
                    </span>
                  </div>
                  {b.bestPrice < b.current && b.bestSupplier && (
                    <div className="w-full text-xs text-success">
                      💡 Eng arzon: {formatMoney(b.bestPrice)} — {b.bestSupplier}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
