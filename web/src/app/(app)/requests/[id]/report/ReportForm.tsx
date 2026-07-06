"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PhotoUpload from "@/components/PhotoUpload";
import NumberInput from "@/components/NumberInput";
import { EXPENSE_GROUPS, TYPE_GROUPS } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { submitReportAction } from "../../actions";

interface Item { name: string; category: string; supplier: string; qty: number; price: number; }
const empty: Item = { name: "", category: "", supplier: "", qty: 1, price: 0 };

export default function ReportForm({ requestId, type }: { requestId: number; type: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([{ ...empty }]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups = TYPE_GROUPS[type] ?? Object.keys(EXPENSE_GROUPS);
  const total = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);

  function update(i: number, patch: Partial<Item>) {
    setItems((arr) => arr.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  }

  async function submit() {
    setBusy(true); setError(null);
    const valid = items.filter((it) => it.name.trim());
    const fd = new FormData();
    fd.set("id", String(requestId));
    fd.set("note", note);
    fd.set("items_json", JSON.stringify(valid));
    fd.set("photos_json", JSON.stringify(photos));
    const res = await submitReportAction(fd);
    if (res?.error) { setError(res.error); setBusy(false); return; }
    router.push(`/requests/${requestId}`);
  }

  return (
    <div className="card p-5 space-y-4">
      <div>
        <label className="label">Izoh</label>
        <textarea className="textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Bajarilgan ish haqida…" />
      </div>

      <div>
        <label className="label">Xarajatlar</label>
        <div className="space-y-3">
          {items.map((it, i) => (
            <div key={i} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex gap-2">
                <input className="input flex-1" placeholder="Nomi" value={it.name}
                  onChange={(e) => update(i, { name: e.target.value })} />
                {items.length > 1 && (
                  <button type="button" className="btn btn-ghost !px-3"
                    onClick={() => setItems((a) => a.filter((_, j) => j !== i))}>×</button>
                )}
              </div>
              <select className="select" value={it.category} onChange={(e) => update(i, { category: e.target.value })}>
                <option value="">— kategoriya —</option>
                {groups.map((g) => (
                  <optgroup key={g} label={g}>
                    {EXPENSE_GROUPS[g]?.map((c) => <option key={c} value={c}>{c}</option>)}
                  </optgroup>
                ))}
              </select>
              <div className="flex gap-2">
                <input className="input" type="number" placeholder="Soni" value={it.qty}
                  onChange={(e) => update(i, { qty: Number(e.target.value) })} />
                <NumberInput className="input" placeholder="Narx (so'm)" value={it.price || null}
                  onValueChange={(n) => update(i, { price: n ?? 0 })} />
              </div>
              <input className="input" placeholder="Yetkazib beruvchi (ixtiyoriy)" value={it.supplier}
                onChange={(e) => update(i, { supplier: e.target.value })} />
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-ghost mt-2" onClick={() => setItems((a) => [...a, { ...empty }])}>
          + Qator qo'shish
        </button>
      </div>

      <div className="text-right font-semibold">Jami: {formatMoney(total)}</div>

      <div>
        <label className="label">Rasmlar</label>
        <PhotoUpload value={photos} onChange={setPhotos} />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button className="btn btn-brand w-full" disabled={busy} onClick={submit}>
        {busy ? "Yuborilmoqda…" : "Hisobotni topshirish"}
      </button>
    </div>
  );
}
