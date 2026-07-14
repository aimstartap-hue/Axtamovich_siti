"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, Plus } from "lucide-react";

const inputStyle = { background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" } as const;

export default function OpeningFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");

  function apply(next: Record<string, string>) {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) { if (v) p.set(k, v); else p.delete(k); }
    router.replace(`/openings?${p.toString()}`, { scroll: false });
  }

  useEffect(() => {
    const t = setTimeout(() => { if ((sp.get("q") ?? "") !== q) apply({ q }); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl p-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="relative flex-1 min-w-[180px]">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filial nomi bo'yicha qidiruv" className="w-full text-sm pl-9 pr-3 py-2 rounded-xl outline-none" style={inputStyle} />
      </div>
      <input type="month" value={sp.get("month") ?? ""} onChange={(e) => apply({ month: e.target.value })} className="text-sm px-2.5 py-2 rounded-xl outline-none" style={inputStyle} aria-label="Oy" />
      <select value={sp.get("status") ?? ""} onChange={(e) => apply({ status: e.target.value })} className="text-sm px-3 py-2 rounded-xl outline-none cursor-pointer" style={inputStyle} aria-label="Holat">
        <option value="">Barcha holat</option>
        <option value="active">Jarayonda</option>
        <option value="done">Tugallangan</option>
        <option value="problem">Muammoli</option>
      </select>
      <Link href="/requests/new" className="btn btn-brand flex items-center gap-1.5 !py-2 text-sm"><Plus size={16} /> Yangi loyiha</Link>
    </div>
  );
}
