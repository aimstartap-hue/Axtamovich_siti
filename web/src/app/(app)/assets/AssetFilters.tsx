"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";

const st = { background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" } as const;
const cls = "text-sm px-2.5 py-2 rounded-xl outline-none cursor-pointer";

export default function AssetFilters({ branches, categories, assignees }: { branches: { id: number; name: string }[]; categories: string[]; assignees: { id: string; name: string }[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");

  function apply(next: Record<string, string>) {
    const p = new URLSearchParams(sp.toString());
    p.delete("page");
    for (const [k, v] of Object.entries(next)) { if (v) p.set(k, v); else p.delete(k); }
    router.replace(`/assets?${p.toString()}`, { scroll: false });
  }
  useEffect(() => {
    const t = setTimeout(() => { if ((sp.get("q") ?? "") !== q) apply({ q }); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const has = ["branch", "category", "assignee", "kpi", "from", "to", "pmin", "pmax"].some((k) => sp.get(k)) || q;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl p-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="relative flex-1 min-w-[170px]">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nomi / inventar # / seriya" className="w-full text-sm pl-9 pr-3 py-2 rounded-xl outline-none" style={st} />
      </div>
      <select value={sp.get("branch") ?? ""} onChange={(e) => apply({ branch: e.target.value })} className={cls} style={st} aria-label="Filial">
        <option value="">Barcha filial</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
      <select value={sp.get("category") ?? ""} onChange={(e) => apply({ category: e.target.value })} className={cls} style={st} aria-label="Kategoriya">
        <option value="">Barcha kategoriya</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select value={sp.get("assignee") ?? ""} onChange={(e) => apply({ assignee: e.target.value })} className={cls} style={st} aria-label="Mas'ul">
        <option value="">Har qanday mas&apos;ul</option>{assignees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      <select value={sp.get("kpi") ?? ""} onChange={(e) => apply({ kpi: e.target.value })} className={cls} style={st} aria-label="Holat">
        <option value="">Barcha holat</option>
        <option value="active">Faol</option><option value="repair">Ta&apos;mirda</option><option value="moved">Ko&apos;chirilgan</option><option value="lost">Yo&apos;qolgan</option><option value="written_off">Hisobdan chiqarilgan</option>
      </select>
      <label className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl" style={st}>
        <input type="date" value={sp.get("from") ?? ""} onChange={(e) => apply({ from: e.target.value })} className="bg-transparent outline-none" style={{ color: "var(--text)" }} aria-label="Sotib olingan (dan)" />
        <span style={{ color: "var(--muted)" }}>—</span>
        <input type="date" value={sp.get("to") ?? ""} onChange={(e) => apply({ to: e.target.value })} className="bg-transparent outline-none" style={{ color: "var(--text)" }} aria-label="Sotib olingan (gacha)" />
      </label>
      <input type="number" value={sp.get("pmin") ?? ""} onChange={(e) => apply({ pmin: e.target.value })} placeholder="Narx ≥" className="w-24 text-sm px-2.5 py-2 rounded-xl outline-none" style={st} aria-label="Narx min" />
      <input type="number" value={sp.get("pmax") ?? ""} onChange={(e) => apply({ pmax: e.target.value })} placeholder="Narx ≤" className="w-24 text-sm px-2.5 py-2 rounded-xl outline-none" style={st} aria-label="Narx max" />
      {has && <button onClick={() => { setQ(""); router.replace("/assets", { scroll: false }); }} className="inline-flex items-center gap-1 text-xs px-2.5 py-2 rounded-xl hover:bg-surface-2" style={{ color: "var(--muted)" }}><X size={14} /> Tozalash</button>}
    </div>
  );
}
