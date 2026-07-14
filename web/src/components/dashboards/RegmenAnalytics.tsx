"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/workflow";
import { isOpen, isInProgress } from "@/lib/helpers";

export interface RegReq {
  id: number;
  title: string;
  status: string;
  branch_id: number | null;
  deadline: string | null;
  created_at: string;
  priority: string | null;
}
interface Branch { id: number; name: string; }

// Status -> guruh (doiraviy diagramma toifalari)
type Bucket = "open" | "doing" | "closed" | "rejected";
function bucketOf(status: string): Bucket {
  if (status === "closed") return "closed";
  if (status === "rejected") return "rejected";
  if (isInProgress(status)) return "doing";
  return "open";
}
const BUCKETS: { key: Bucket; label: string; color: string }[] = [
  { key: "open", label: "Ochiq", color: "#eda100" },
  { key: "doing", label: "Bajarilmoqda", color: "#2a78d6" },
  { key: "closed", label: "Yopilgan", color: "#0ca30c" },
  { key: "rejected", label: "Rad etilgan", color: "#d03b3b" },
];

export default function RegmenAnalytics({ branches, requests }: { branches: Branch[]; requests: RegReq[] }) {
  const [branchId, setBranchId] = useState<number | "all">("all");
  const [statusView, setStatusView] = useState<Bucket | "all">("all");

  const filtered = useMemo(
    () => requests.filter((r) => branchId === "all" || r.branch_id === branchId),
    [requests, branchId],
  );

  // Bar diagramma ma'lumoti
  const bars = useMemo(() => {
    if (branchId === "all") {
      return branches
        .map((b) => ({
          label: b.name.replace("Zahratun fast-food ", "").replace(/[()]/g, ""),
          value: requests.filter((r) => r.branch_id === b.id && isOpen(r.status)).length,
        }))
        .sort((a, b) => b.value - a.value);
    }
    return BUCKETS.map((bk) => ({
      label: bk.label,
      value: filtered.filter((r) => bucketOf(r.status) === bk.key).length,
      color: bk.color,
    }));
  }, [branchId, branches, requests, filtered]);
  const maxBar = Math.max(1, ...bars.map((b) => b.value));

  // Doiraviy diagramma ma'lumoti
  const donut = useMemo(
    () => BUCKETS.map((bk) => ({ ...bk, value: filtered.filter((r) => bucketOf(r.status) === bk.key).length })),
    [filtered],
  );
  const total = donut.reduce((s, d) => s + d.value, 0);

  // Ro'yxat (doiraviy filtriga qarab)
  const list = filtered
    .filter((r) => statusView === "all" || bucketOf(r.status) === statusView)
    .sort((a, b) => b.id - a.id);

  // Donut segmentlari (stroke-dasharray)
  let acc = 0;
  const segs = donut.map((d) => {
    const frac = total ? d.value / total : 0;
    const seg = { color: d.color, len: frac * 100, offset: 25 - acc };
    acc += frac * 100;
    return seg;
  });

  return (
    <div className="space-y-5">
      {/* Filtr */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted">Filial:</span>
        <select className="select w-auto" value={branchId}
          onChange={(e) => setBranchId(e.target.value === "all" ? "all" : Number(e.target.value))}>
          <option value="all">Barcha filiallar</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {/* Bar diagramma (uzun chiziqlar) */}
      <div className="card p-5">
        <h2 className="font-semibold mb-4">
          {branchId === "all" ? "Ochiq zayavkalar — filiallar bo'yicha" : "Holat bo'yicha taqsimot"}
        </h2>
        <div className="space-y-2.5">
          {bars.map((b, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-32 md:w-44 text-xs truncate text-right text-muted shrink-0">{b.label}</div>
              <div className="flex-1 h-6 bg-surface-2 rounded-md overflow-hidden">
                <div className="h-full rounded-md flex items-center justify-end pr-2 text-[11px] font-semibold text-white transition-all"
                  style={{
                    width: `${Math.max((b.value / maxBar) * 100, b.value > 0 ? 8 : 0)}%`,
                    background: ("color" in b && b.color) ? (b.color as string) : "var(--brand)",
                    minWidth: b.value > 0 ? "1.75rem" : 0,
                  }}>
                  {b.value > 0 ? b.value : ""}
                </div>
              </div>
              {b.value === 0 && <span className="text-xs text-muted w-4">0</span>}
            </div>
          ))}
          {bars.length === 0 && <div className="text-sm text-muted text-center py-4">Ma'lumot yo'q.</div>}
        </div>
      </div>

      {/* Doiraviy diagramma + legenda-filtr */}
      <div className="card p-5">
        <h2 className="font-semibold mb-4">Holatlar ulushi</h2>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <svg viewBox="0 0 42 42" className="w-40 h-40 shrink-0 -rotate-90">
            <circle cx="21" cy="21" r="15.915" fill="none" stroke="var(--surface-2)" strokeWidth="5" />
            {total > 0 && segs.map((s, i) => s.len > 0 && (
              <circle key={i} cx="21" cy="21" r="15.915" fill="none" stroke={s.color} strokeWidth="5"
                strokeDasharray={`${s.len} ${100 - s.len}`} strokeDashoffset={s.offset} />
            ))}
            <text x="21" y="21" transform="rotate(90 21 21)" textAnchor="middle" dominantBaseline="central"
              style={{ fontSize: "7px", fontWeight: 700, fill: "var(--text)" }}>{total}</text>
          </svg>
          <div className="flex-1 w-full space-y-1">
            <button onClick={() => setStatusView("all")}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm ${statusView === "all" ? "bg-surface-2 font-semibold" : ""}`}>
              <span>Barchasi</span><span className="text-muted">{total}</span>
            </button>
            {donut.map((d) => (
              <button key={d.key} onClick={() => setStatusView(d.key)}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm ${statusView === d.key ? "bg-surface-2 font-semibold" : ""}`}>
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm" style={{ background: d.color }} />{d.label}
                </span>
                <span className="text-muted">{d.value}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Ro'yxat (tanlangan holat bo'yicha) */}
      <div>
        <h2 className="font-semibold mb-2">
          {statusView === "all" ? "Barcha zayavkalar" : BUCKETS.find((b) => b.key === statusView)?.label} ({list.length})
        </h2>
        <div className="space-y-2">
          {list.slice(0, 40).map((r) => (
            <Link key={r.id} href={`/requests/${r.id}`} className="card p-3 flex items-center gap-3 hover:bg-surface-2 transition">
              <span className="text-xs font-mono text-muted w-10">#{r.id}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{r.title}</div>
                <div className="text-xs text-muted">{formatDate(r.created_at)}</div>
              </div>
              <span className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: BUCKETS.find((b) => b.key === bucketOf(r.status))!.color }}
                title={STATUS_LABELS[r.status] ?? r.status} />
            </Link>
          ))}
          {list.length === 0 && <div className="card p-6 text-center text-muted text-sm">Zayavka yo'q.</div>}
        </div>
      </div>
    </div>
  );
}
