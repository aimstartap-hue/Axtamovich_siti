"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { REQUEST_TYPES, STATUS_LABELS, PRIORITY_LABELS } from "@/lib/constants";
import { currentMonthBounds } from "@/lib/helpers";

const OWNERS = ["AXO", "CEO", "Moliya", "Menejer", "Open group", "HR"];
const selectCls = "text-sm px-2.5 py-2 rounded-xl outline-none cursor-pointer";
const selectStyle = { background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" } as const;

export default function RequestFilters({ branches }: { branches: { id: number; name: string }[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");

  function apply(next: Record<string, string>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) { if (v) params.set(k, v); else params.delete(k); }
    router.replace(`/requests?${params.toString()}`, { scroll: false });
  }

  useEffect(() => {
    const t = setTimeout(() => { if ((sp.get("q") ?? "") !== q) apply({ q }); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const bounds = currentMonthBounds();
  const hasFilters = ["type", "status", "priority", "branch", "owner", "from", "to", "kpi"].some((k) => sp.get(k)) || q;

  return (
    <div className="rounded-2xl p-3 flex flex-wrap items-center gap-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="relative flex-1 min-w-[180px]">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Qidiruv: nomi yoki #raqam"
          className="w-full text-sm pl-9 pr-3 py-2 rounded-xl outline-none" style={selectStyle} />
      </div>

      <select value={sp.get("branch") ?? ""} onChange={(e) => apply({ branch: e.target.value })} className={selectCls} style={selectStyle} aria-label="Filial">
        <option value="">Barcha filial</option>
        {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>

      <select value={sp.get("status") ?? ""} onChange={(e) => apply({ status: e.target.value })} className={selectCls} style={selectStyle} aria-label="Holat">
        <option value="">Barcha holat</option>
        {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>

      <select value={sp.get("type") ?? ""} onChange={(e) => apply({ type: e.target.value })} className={selectCls} style={selectStyle} aria-label="Tur">
        <option value="">Barcha tur</option>
        {Object.entries(REQUEST_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>

      <select value={sp.get("priority") ?? ""} onChange={(e) => apply({ priority: e.target.value })} className={selectCls} style={selectStyle} aria-label="Prioritet">
        <option value="">Har qanday prioritet</option>
        {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>

      <select value={sp.get("owner") ?? ""} onChange={(e) => apply({ owner: e.target.value })} className={selectCls} style={selectStyle} aria-label="Mas'ul">
        <option value="">Har qanday mas&apos;ul</option>
        {OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>

      <label className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl" style={selectStyle}>
        <input type="date" value={sp.get("from") ?? bounds.from} onChange={(e) => apply({ from: e.target.value })} className="bg-transparent outline-none" style={{ color: "var(--text)" }} aria-label="Boshlanish sanasi" />
        <span style={{ color: "var(--muted)" }}>—</span>
        <input type="date" value={sp.get("to") ?? bounds.to} onChange={(e) => apply({ to: e.target.value })} className="bg-transparent outline-none" style={{ color: "var(--text)" }} aria-label="Tugash sanasi" />
      </label>

      {hasFilters && (
        <button onClick={() => { setQ(""); router.replace("/requests", { scroll: false }); }}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-2 rounded-xl hover:bg-surface-2 transition" style={{ color: "var(--muted)" }}>
          <X size={14} /> Tozalash
        </button>
      )}
    </div>
  );
}
