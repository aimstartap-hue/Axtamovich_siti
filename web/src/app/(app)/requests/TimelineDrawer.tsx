"use client";

import Link from "next/link";
import { useEffect } from "react";
import { X, ExternalLink, MessageSquare, CircleCheck, CircleDot } from "lucide-react";
import { formatDate } from "@/lib/workflow";
import { relativeTime } from "@/lib/requests-view";

export interface TimelineEvent { action: string; comment: string | null; who: string; at: string }
export interface DrawerRow { id: number; title: string; statusLabel: string }

// Zayavka Timeline drawer'i — workflow bosqichlari (kim · qachon · izoh).
export default function TimelineDrawer({ row, events, onClose }: { row: DrawerRow | null; events: TimelineEvent[]; onClose: () => void }) {
  useEffect(() => {
    if (!row) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [row, onClose]);

  if (!row) return null;
  const ordered = [...events].sort((a, b) => (a.at < b.at ? -1 : 1)); // eskisidan yangisiga

  return (
    <>
      <div className="fixed inset-0 z-40 animate-fade" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose} />
      <aside className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md flex flex-col animate-drawer"
        style={{ background: "var(--surface)", borderLeft: "1px solid var(--border)" }}
        role="dialog" aria-modal="true" aria-label={`Zayavka #${row.id} timeline`}>
        <div className="flex items-center justify-between px-5 h-14 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          <div className="min-w-0">
            <div className="text-xs" style={{ color: "var(--muted)" }}>Zayavka #{row.id}</div>
            <div className="font-semibold truncate text-sm">{row.title}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 shrink-0" aria-label="Yopish"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="text-xs font-medium mb-4" style={{ color: "var(--muted)" }}>Harakatlar tarixi</div>
          {ordered.length === 0 ? (
            <div className="text-sm text-center py-8" style={{ color: "var(--muted)" }}>Hali harakat yo&apos;q.</div>
          ) : (
            <ol className="relative">
              {ordered.map((e, i) => {
                const last = i === ordered.length - 1;
                return (
                  <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
                    {!last && <span className="absolute left-[9px] top-6 bottom-0 w-px" style={{ background: "var(--border)" }} />}
                    <span className="shrink-0 mt-0.5" style={{ color: last ? "var(--brand)" : "var(--muted)" }}>
                      {last ? <CircleDot size={20} /> : <CircleCheck size={20} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{e.action}</div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                        {e.who} · {formatDate(e.at)} · {relativeTime(e.at)}
                      </div>
                      {e.comment && (
                        <div className="mt-1.5 text-xs rounded-lg px-3 py-2 flex gap-2" style={{ background: "var(--surface-2)" }}>
                          <MessageSquare size={13} className="shrink-0 mt-0.5" style={{ color: "var(--muted)" }} />
                          <span>{e.comment}</span>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="p-4 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
          <Link href={`/requests/${row.id}`} className="btn btn-brand !py-2 text-sm w-full flex items-center justify-center gap-2">
            <ExternalLink size={15} /> To&apos;liq ko&apos;rish
          </Link>
        </div>
      </aside>
    </>
  );
}
