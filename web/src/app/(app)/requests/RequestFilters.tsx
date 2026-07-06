"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { REQUEST_TYPES, STATUS_LABELS } from "@/lib/constants";

/** Zayavkalar filtri — o'zgartirilishi bilan darrov qo'llanadi (tugma yo'q). */
export default function RequestFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");

  function apply(next: Record<string, string>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v); else params.delete(k);
    }
    router.replace(`/requests?${params.toString()}`);
  }

  // Qidiruvni yozilishi bilan (biroz kechikish bilan) qo'llash
  useEffect(() => {
    const t = setTimeout(() => {
      if ((sp.get("q") ?? "") !== q) apply({ q });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="card p-3 flex flex-wrap gap-2 items-end">
      <div className="flex-1 min-w-40">
        <label className="label">Qidiruv</label>
        <input value={q} onChange={(e) => setQ(e.target.value)} className="input" placeholder="Sarlavha yoki #raqam" />
      </div>
      <div>
        <label className="label">Tur</label>
        <select value={sp.get("type") ?? ""} onChange={(e) => apply({ type: e.target.value })} className="select">
          <option value="">Barchasi</option>
          {Object.entries(REQUEST_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Holat</label>
        <select value={sp.get("status") ?? ""} onChange={(e) => apply({ status: e.target.value })} className="select">
          <option value="">Barchasi</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
    </div>
  );
}
