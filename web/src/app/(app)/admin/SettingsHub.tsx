"use client";

import { useState } from "react";
import { ChevronRight, ChevronLeft, Search } from "lucide-react";

// =============================================================================
// Sozlamalar hub — katta kartalar (icon/sarlavha/izoh/>), bosilganda ichki
// sahifa ochiladi (in-page, route o'zgarmaydi). Yangi bo'lim qo'shish = sections
// massiviga bitta obyekt qo'shish. Backend/action'lar server tarafda ulanadi.
// =============================================================================

export interface SettingsSection {
  id: string;
  icon: string;
  accent: string;
  title: string;
  desc: string;
  group: string;
  adminOnly?: boolean;
  status?: string;
  statusTone?: string;
  content: React.ReactNode;
}

export default function SettingsHub({ sections }: { sections: SettingsSection[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const cur = sections.find((s) => s.id === active);

  // --- Ichki sahifa ---
  if (cur) {
    return (
      <div className="space-y-5 animate-fade">
        {/* Breadcrumb */}
        <button onClick={() => setActive(null)} className="inline-flex items-center gap-1.5 text-xs font-medium transition hover:opacity-80" style={{ color: "var(--muted)" }}>
          <ChevronLeft size={14} /> Sozlamalar <span className="opacity-40">/</span> <span style={{ color: "var(--text)" }}>{cur.title}</span>
        </button>
        {/* Sahifa sarlavhasi */}
        <div className="flex items-center gap-4">
          <span className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0" style={{ background: `${cur.accent}1f`, color: cur.accent }}>{cur.icon}</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight leading-tight">{cur.title}</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>{cur.desc}</p>
          </div>
          {cur.status && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full shrink-0" style={{ background: `${cur.statusTone ?? "#22c55e"}1f`, color: cur.statusTone ?? "#22c55e" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: cur.statusTone ?? "#22c55e" }} />{cur.status}
            </span>
          )}
        </div>
        {/* Guruhlar (kontent o'z konteynerlarini beradi) */}
        <div className="space-y-4">{cur.content}</div>
      </div>
    );
  }

  // --- Hub (kartalar) ---
  const groups = [...new Set(sections.map((s) => s.group))];
  const match = (s: SettingsSection) => !q.trim() || (s.title + s.desc).toLowerCase().includes(q.toLowerCase());

  return (
    <div className="space-y-6">
      <div className="relative max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sozlamalarda qidirish…"
          className="w-full text-sm pl-9 pr-3 py-2.5 rounded-xl outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }} />
      </div>

      {groups.map((grp) => {
        const items = sections.filter((s) => s.group === grp && match(s));
        if (items.length === 0) return null;
        return (
          <div key={grp}>
            <div className="text-[11px] font-semibold uppercase tracking-wider mb-2.5 px-1" style={{ color: "var(--muted)" }}>{grp}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {items.map((s) => (
                <button key={s.id} onClick={() => setActive(s.id)}
                  className="group flex items-center gap-3.5 text-left rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <span className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: `${s.accent}1f`, color: s.accent }}>{s.icon}</span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{s.title}</span>
                      {s.status && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: `${s.statusTone ?? "var(--muted)"}1f`, color: s.statusTone ?? "var(--muted)" }}>{s.status}</span>}
                    </span>
                    <span className="block text-[12px] mt-0.5 truncate" style={{ color: "var(--muted)" }}>{s.desc}</span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: "var(--muted)" }} />
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
