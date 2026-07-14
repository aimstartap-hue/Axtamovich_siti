"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Eye, History, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { formatDate } from "@/lib/workflow";
import type { Priority } from "@/lib/constants";
import { statusView, priorityView, slaView, relativeTime, type Tone } from "@/lib/requests-view";
import TimelineDrawer, { type TimelineEvent, type DrawerRow } from "./TimelineDrawer";

export interface TableRow {
  id: number;
  type: "maintenance" | "new_branch";
  title: string;
  branch: string;
  category: string | null;
  requested: number | null;
  actual: number | null;
  status: string;
  priority: Priority | null;
  owner: string | null;
  requester: string;
  lastActionText: string | null;
  lastActionAt: string | null;
  deadline: string | null;
  createdAt: string;
}

const TONE: Record<Tone, { bg: string; fg: string }> = {
  green: { bg: "#199e7024", fg: "#22c55e" },
  blue: { bg: "#3987e524", fg: "#60a5fa" },
  amber: { bg: "#c9850028", fg: "#fbbf24" },
  orange: { bg: "#d9592626", fg: "#fb923c" },
  red: { bg: "#d03b3b26", fg: "#f87171" },
  gray: { bg: "#8987811f", fg: "#9ca3af" },
};

function Chip({ label, tone, dot }: { label: string; tone: Tone; dot?: boolean }) {
  const c = TONE[tone];
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap" style={{ background: c.bg, color: c.fg }}>
      {dot && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.fg }} />}{label}
    </span>
  );
}

type SortKey = "id" | "requested" | "actual" | "deadline" | "createdAt";
const PAGE_SIZES = [10, 25, 50];

export default function RequestsTable({ rows, eventsByReq }: { rows: TableRow[]; eventsByReq: Record<number, TimelineEvent[]> }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "id", dir: -1 });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [drawer, setDrawer] = useState<DrawerRow | null>(null);

  const sorted = useMemo(() => {
    const val = (r: TableRow): number => {
      switch (sort.key) {
        case "requested": return r.requested ?? -1;
        case "actual": return r.actual ?? -1;
        case "deadline": return r.deadline ? new Date(r.deadline).getTime() : -Infinity;
        case "createdAt": return new Date(r.createdAt).getTime();
        default: return r.id;
      }
    };
    return [...rows].sort((a, b) => (val(a) - val(b)) * sort.dir);
  }, [rows, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const clampedPage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(clampedPage * pageSize, clampedPage * pageSize + pageSize);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: -1 }));
    setPage(0);
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl p-12 flex flex-col items-center gap-3 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <Inbox size={40} style={{ color: "var(--muted)" }} />
        <div className="text-sm font-medium">Zayavka topilmadi</div>
        <div className="text-xs" style={{ color: "var(--muted)" }}>Filtrlarni o&apos;zgartiring yoki yangi zayavka yarating.</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left" style={{ color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
              <Th sortable onSort={() => toggleSort("id")} sort={sort} k="id" className="w-16 pl-4">ID</Th>
              <th className="font-medium text-xs px-3 py-3">Zayavka</th>
              <th className="font-medium text-xs px-3 py-3 hidden sm:table-cell">Filial</th>
              <th className="font-medium text-xs px-3 py-3 hidden xl:table-cell">Kategoriya</th>
              <Th sortable onSort={() => toggleSort("requested")} sort={sort} k="requested" className="text-right">So&apos;ralgan</Th>
              <Th sortable onSort={() => toggleSort("actual")} sort={sort} k="actual" className="text-right hidden 2xl:table-cell">Haqiqiy</Th>
              <th className="font-medium text-xs px-3 py-3">Holat</th>
              <th className="font-medium text-xs px-3 py-3 hidden lg:table-cell">Prioritet</th>
              <th className="font-medium text-xs px-3 py-3 hidden xl:table-cell">Mas&apos;ul</th>
              <th className="font-medium text-xs px-3 py-3 hidden 2xl:table-cell">Oxirgi harakat</th>
              <Th sortable onSort={() => toggleSort("deadline")} sort={sort} k="deadline">Deadline / SLA</Th>
              <th className="font-medium text-xs px-3 py-3 text-right pr-4">Amallar</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => {
              const st = statusView(r.status);
              const pr = priorityView(r.priority);
              const sla = slaView(r.deadline, r.status);
              return (
                <tr key={r.id} onClick={() => setDrawer({ id: r.id, title: r.title, statusLabel: st.label })}
                  className="cursor-pointer transition group hover:bg-[var(--surface-2)]" style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-3 py-3 pl-4 tabular-nums" style={{ color: "var(--muted)" }}>#{r.id}</td>
                  <td className="px-3 py-3 max-w-[240px]">
                    <div className="font-medium truncate">{r.title}</div>
                    <div className="text-[11px] mt-0.5 truncate" style={{ color: "var(--muted)" }}>{r.type === "new_branch" ? "Ochilish" : "Texnik"} · 👤 {r.requester}</div>
                  </td>
                  <td className="px-3 py-3 hidden sm:table-cell whitespace-nowrap">{r.branch}</td>
                  <td className="px-3 py-3 hidden xl:table-cell max-w-[160px]"><span className="truncate block" style={{ color: "var(--muted)" }}>{r.category ?? "—"}</span></td>
                  <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap font-medium">{r.requested != null ? formatMoney(r.requested) : "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap hidden 2xl:table-cell" style={{ color: "var(--muted)" }}>{r.actual != null ? formatMoney(r.actual) : "—"}</td>
                  <td className="px-3 py-3"><Chip label={st.label} tone={st.tone} dot /></td>
                  <td className="px-3 py-3 hidden lg:table-cell">{pr ? <Chip label={pr.label} tone={pr.tone} /> : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                  <td className="px-3 py-3 hidden xl:table-cell whitespace-nowrap">{r.owner ?? <span style={{ color: "var(--muted)" }}>—</span>}</td>
                  <td className="px-3 py-3 hidden 2xl:table-cell whitespace-nowrap">
                    {r.lastActionText ? (
                      <div>
                        <div className="truncate max-w-[160px]">{r.lastActionText}</div>
                        <div className="text-[11px]" style={{ color: "var(--muted)" }}>{relativeTime(r.lastActionAt)}</div>
                      </div>
                    ) : <span style={{ color: "var(--muted)" }}>—</span>}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {r.deadline ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs tabular-nums" style={{ color: "var(--muted)" }}>{formatDate(r.deadline)}</span>
                        {sla && <Chip label={sla.label} tone={sla.tone} dot />}
                      </div>
                    ) : <span style={{ color: "var(--muted)" }}>—</span>}
                  </td>
                  <td className="px-3 py-3 pr-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setDrawer({ id: r.id, title: r.title, statusLabel: st.label })}
                        className="p-1.5 rounded-lg hover:bg-[var(--surface)] transition" title="Timeline" aria-label="Timeline">
                        <History size={16} style={{ color: "var(--muted)" }} />
                      </button>
                      <Link href={`/requests/${r.id}`} className="p-1.5 rounded-lg hover:bg-[var(--surface)] transition" title="Ko'rish" aria-label="Ko'rish">
                        <Eye size={16} style={{ color: "var(--muted)" }} />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs" style={{ color: "var(--muted)", borderTop: "1px solid var(--border)" }}>
        <div>Jami <b style={{ color: "var(--text)" }}>{sorted.length}</b> ta · {clampedPage * pageSize + 1}–{Math.min((clampedPage + 1) * pageSize, sorted.length)}</div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5">
            Qatorlar
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
              className="rounded-lg px-2 py-1 outline-none cursor-pointer" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}>
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={clampedPage === 0}
              className="p-1.5 rounded-lg hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed" aria-label="Oldingi"><ChevronLeft size={16} /></button>
            <span className="tabular-nums px-1">{clampedPage + 1} / {pageCount}</span>
            <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={clampedPage >= pageCount - 1}
              className="p-1.5 rounded-lg hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed" aria-label="Keyingi"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      <TimelineDrawer row={drawer} events={drawer ? eventsByReq[drawer.id] ?? [] : []} onClose={() => setDrawer(null)} />
    </div>
  );
}

function Th({ children, className = "", sortable, onSort, sort, k }: {
  children: React.ReactNode; className?: string; sortable?: boolean; onSort?: () => void; sort?: { key: SortKey; dir: 1 | -1 }; k?: SortKey;
}) {
  const active = sort && k && sort.key === k;
  return (
    <th className={`font-medium text-xs px-3 py-3 ${className}`}>
      {sortable ? (
        <button onClick={onSort} className="inline-flex items-center gap-1 hover:text-[var(--text)] transition">
          {children}
          {active ? (sort!.dir === 1 ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : <ChevronsUpDown size={13} style={{ opacity: 0.4 }} />}
        </button>
      ) : children}
    </th>
  );
}
