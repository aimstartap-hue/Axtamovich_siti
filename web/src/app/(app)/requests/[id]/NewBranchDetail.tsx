"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X, Sparkles, MessageSquare } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { approveAction, rejectAction, addCommentAction } from "../actions";

export interface Position { part: string; amount: number; icon: string }
export interface TimelineItem { title: string; by: string; date: string; color: string }
export interface CommentItem { by: string; role: string; date: string; text: string }
export interface AiInsight { tone: "warn" | "ok"; label: string; text: string }

export interface NewBranchData {
  id: number;
  title: string;
  branch: string;
  creator: string;
  dateLabel: string;
  responsible: string;
  statusLabel: string;
  statusColor: string;
  priorityLabel: string;
  ageLabel: string;
  total: number;
  positions: Position[];
  ai: { level: string; levelColor: string; insights: AiInsight[]; recommendation: string };
  timeline: TimelineItem[];
  comments: CommentItem[];
  canApprove: boolean;
  canReject: boolean;
  needsDeadline: boolean;
  createdIso: string;
}

const C = { surface: "var(--surface)", border: "var(--border)", muted: "var(--muted)" };

export default function NewBranchDetail({ data }: { data: NewBranchData }) {
  const [tab, setTab] = useState<"pos" | "timeline" | "comments">("pos");
  const [mode, setMode] = useState<null | "approve" | "reject">(null);
  const initials = (n: string) => n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: "var(--bg)" }}>
      <div className="h-1 shrink-0" style={{ background: "linear-gradient(90deg,#2563eb,#8b5cf6)" }} />

      {/* Header */}
      <div className="px-6 sm:px-10 pt-5 pb-4 border-b shrink-0" style={{ borderColor: C.border, background: C.surface }}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold tracking-wide" style={{ color: C.muted }}>ZAYAVKA #{data.id} · YANGI FILIAL</div>
            <h1 className="text-2xl font-bold mt-1 tracking-tight truncate">{data.title}</h1>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: `${data.statusColor}1f`, color: data.statusColor }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: data.statusColor }} />{data.statusLabel}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: "var(--surface-2)", color: C.muted }}>{data.priorityLabel}</span>
              <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: "var(--surface-2)", color: C.muted }}>{data.ageLabel}</span>
            </div>
          </div>
          <Link href="/requests" className="p-2 rounded-xl transition hover:bg-[var(--surface-2)] shrink-0" aria-label="Yopish" title="Yopish"><X size={20} /></Link>
        </div>
      </div>

      {/* Meta strip */}
      <div className="px-6 sm:px-10 py-4 border-b flex flex-wrap items-center justify-between gap-4 shrink-0" style={{ borderColor: C.border, background: "color-mix(in srgb, var(--surface-2) 40%, transparent)" }}>
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          {[["Filial", data.branch], ["Yaratdi", data.creator], ["Sana", data.dateLabel], ["Mas'ul", data.responsible || "—"]].map(([l, v]) => (
            <div key={l}><div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>{l}</div><div className="text-sm font-semibold mt-0.5">{v}</div></div>
          ))}
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>So&apos;ralgan summa</div>
          <div className="text-3xl font-extrabold tabular-nums mt-0.5">{formatNumber(data.total)} <span className="text-base" style={{ color: C.muted }}>so&apos;m</span></div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-5">
        <div className="max-w-5xl mx-auto">
          {/* AI card */}
          <div className="rounded-2xl p-4 sm:p-5" style={{ border: "1px solid #2a2545", background: "linear-gradient(135deg, rgba(139,92,246,.09), rgba(37,99,235,.05))" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#8b5cf6,#2563eb)" }}><Sparkles size={15} color="#fff" /></span>
                <span className="font-semibold text-sm">AI tahlili</span>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: `${data.ai.levelColor}1f`, color: data.ai.levelColor }}>{data.ai.level}</span>
            </div>
            <div className="space-y-2.5">
              {data.ai.insights.map((it, i) => (
                <div key={i} className="flex gap-2.5 items-start">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: it.tone === "warn" ? "#f59e0b" : "#22c55e" }} />
                  <div className="text-[13px] leading-relaxed" style={{ color: "var(--text)" }}><b>{it.label}:</b> <span style={{ color: C.muted }}>{it.text}</span></div>
                </div>
              ))}
            </div>
            <div className="mt-3.5 p-3 rounded-xl text-[13px] leading-relaxed" style={{ background: "rgba(37,99,235,.1)", border: "1px solid rgba(37,99,235,.22)" }}>
              <b style={{ color: "#8fb0ff" }}>Tavsiya:</b> <span style={{ color: "var(--text)" }}>{data.ai.recommendation}</span>
            </div>
            <div className="mt-2 text-[11px]" style={{ color: C.muted }}>AI namuna · qaror qabul qilishda tekshirib chiqing</div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl mt-5 w-fit" style={{ background: "var(--surface-2)" }}>
            {([["pos", `Pozitsiyalar · ${data.positions.length}`], ["timeline", "Harakatlar tarixi"], ["comments", `Izohlar · ${data.comments.length}`]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className="px-3.5 py-2 rounded-lg text-[13px] font-semibold transition"
                style={tab === k ? { background: C.surface, color: "var(--text)", boxShadow: "0 1px 3px rgba(0,0,0,.15)" } : { color: C.muted }}>{l}</button>
            ))}
          </div>

          {/* Tab: positions */}
          {tab === "pos" && (
            <div className="mt-4 space-y-2.5">
              {data.positions.length === 0 ? <Empty text="Smeta bo'sh." /> : data.positions.map((p, i) => (
                <div key={i} className="flex items-center gap-3 rounded-2xl p-3.5" style={{ border: `1px solid ${C.border}`, background: C.surface }}>
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0" style={{ background: "var(--surface-2)" }}>{p.icon}</span>
                  <div className="flex-1 font-medium">{p.part}</div>
                  <div className="font-bold tabular-nums">{formatNumber(p.amount)} <span className="text-[11px]" style={{ color: C.muted }}>so&apos;m</span></div>
                </div>
              ))}
            </div>
          )}

          {/* Tab: timeline */}
          {tab === "timeline" && (
            <div className="mt-4 pl-1">
              {data.timeline.map((t, i) => (
                <div key={i} className="flex gap-3.5 pb-5 relative">
                  <div className="flex flex-col items-center shrink-0">
                    <span className="w-3.5 h-3.5 rounded-full" style={{ background: t.color, boxShadow: "0 0 0 3px var(--bg)" }} />
                    {i < data.timeline.length - 1 && <span className="w-0.5 flex-1 mt-1" style={{ background: C.border }} />}
                  </div>
                  <div><div className="text-sm font-semibold">{t.title}</div><div className="text-xs mt-0.5" style={{ color: C.muted }}>{t.by} · {t.date}</div></div>
                </div>
              ))}
            </div>
          )}

          {/* Tab: comments */}
          {tab === "comments" && (
            <div className="mt-4">
              <div className="space-y-3 mb-4">
                {data.comments.length === 0 ? <Empty text="Hali izoh yo'q." /> : data.comments.map((c, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "#3b74ff" }}>{initials(c.by)}</span>
                    <div className="flex-1 rounded-xl p-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                      <div className="flex gap-2 items-baseline flex-wrap"><span className="text-sm font-semibold">{c.by}</span><span className="text-[11px]" style={{ color: C.muted }}>{c.role} · {c.date}</span></div>
                      <div className="text-sm mt-1" style={{ color: "var(--text)" }}>{c.text}</div>
                    </div>
                  </div>
                ))}
              </div>
              <form action={addCommentAction} className="rounded-xl p-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <input type="hidden" name="id" value={data.id} />
                <textarea name="text" rows={2} placeholder="Izoh yozing… (masalan: narxlarni qayta ko'ring)" className="w-full bg-transparent outline-none text-sm resize-y" style={{ color: "var(--text)", minHeight: 48 }} />
                <div className="flex justify-end"><button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold text-white" style={{ background: "#3b74ff" }}><MessageSquare size={14} /> Izoh qo&apos;shish</button></div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Action panels */}
      {mode === "approve" && (
        <form action={approveAction} className="px-6 sm:px-10 py-4 border-t shrink-0 animate-fade" style={{ borderColor: C.border, background: C.surface }}>
          <div className="max-w-5xl mx-auto">
            <input type="hidden" name="id" value={data.id} />
            <div className="font-bold text-sm mb-1">Tasdiqlab, keyingi bosqichga yuborish</div>
            <div className="text-xs mb-3" style={{ color: C.muted }}>Tasdiqlangach zayavka Moliyaga o&apos;tadi.</div>
            <div className="grid sm:grid-cols-2 gap-3">
              {data.needsDeadline && (
                <div><label className="text-[11px] font-semibold" style={{ color: C.muted }}>Muddat (deadline)</label>
                  <input type="date" name="deadline" className="input mt-1" defaultValue={data.createdIso} /></div>
              )}
              <div className={data.needsDeadline ? "" : "sm:col-span-2"}><label className="text-[11px] font-semibold" style={{ color: C.muted }}>Izoh (ixtiyoriy)</label>
                <input name="comment" className="input mt-1" placeholder="Moliyaga izoh…" /></div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button type="button" onClick={() => setMode(null)} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ border: `1px solid ${C.border}`, color: C.muted }}>Bekor</button>
              <button className="px-5 py-2 rounded-xl text-sm font-bold text-white" style={{ background: "#2fbf78" }}>Tasdiqlash va yuborish</button>
            </div>
          </div>
        </form>
      )}
      {mode === "reject" && (
        <form action={rejectAction} className="px-6 sm:px-10 py-4 border-t shrink-0 animate-fade" style={{ borderColor: C.border, background: C.surface }}>
          <div className="max-w-5xl mx-auto">
            <input type="hidden" name="id" value={data.id} />
            <div className="font-bold text-sm mb-1">Zayavkani rad etish</div>
            <div className="text-xs mb-3" style={{ color: C.muted }}>Sababini yozing — muallifga yuboriladi.</div>
            <textarea name="comment" rows={2} required placeholder="Sabab (masalan: narxlar juda yuqori, byudjetdan oshadi)" className="textarea" />
            <div className="flex gap-2 justify-end mt-3">
              <button type="button" onClick={() => setMode(null)} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ border: `1px solid ${C.border}`, color: C.muted }}>Bekor</button>
              <button className="px-5 py-2 rounded-xl text-sm font-bold text-white" style={{ background: "#ef4444" }}>Rad etish</button>
            </div>
          </div>
        </form>
      )}

      {/* Footer actions */}
      {!mode && (data.canApprove || data.canReject) && (
        <div className="px-6 sm:px-10 py-4 border-t flex items-center justify-between shrink-0" style={{ borderColor: C.border, background: C.surface }}>
          <div>{data.canReject && (
            <button onClick={() => setMode("reject")} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ border: "1px solid rgba(239,68,68,.4)", color: "#f87171" }}><X size={15} /> Rad etish</button>
          )}</div>
          {data.canApprove && (
            <button onClick={() => setMode("approve")} className="inline-flex items-center gap-2 px-7 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#3b74ff", boxShadow: "0 6px 18px rgba(59,116,255,.3)" }}><Check size={16} /> Tasdiqlash</button>
          )}
        </div>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-center py-8 text-sm" style={{ color: "var(--muted)" }}>{text}</div>;
}
