"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PhotoUpload from "@/components/PhotoUpload";
import { createRequestAction } from "../actions";
import NewBranchEstimate from "./NewBranchEstimate";

interface Branch { id: number; name: string; status: string; }

export default function NewRequestForm({
  branches, canMaintenance, canNewBranch, employeeName, orgName, role,
}: {
  branches: Branch[];
  canMaintenance: boolean;
  canNewBranch: boolean;
  employeeName: string;
  orgName: string;
  role: string;
}) {
  const router = useRouter();
  // Open Group rahbari uchun 1-navbatda "Yangi filial smetasi" ochiladi.
  const defaultType = canNewBranch && (role === "open_group" || !canMaintenance) ? "new_branch" : canMaintenance ? "maintenance" : "new_branch";
  const [type, setType] = useState(defaultType);
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("photos_json", JSON.stringify(photos));
    const res = await createRequestAction(null, fd);
    if (res?.error) { setError(res.error); setBusy(false); }
  }

  const toggle = canMaintenance && canNewBranch && (
    <div className="mx-auto w-full max-w-xl inline-flex p-1 rounded-2xl mb-1" style={{ background: "var(--surface-2)" }}>
      {[["maintenance", "🔧 Texnik zayavka"], ["new_branch", "🏗 Yangi filial smetasi"]].map(([v, l]) => (
        <button key={v} type="button" onClick={() => setType(v)} className="flex-1 px-4 py-2 rounded-xl text-sm font-medium transition"
          style={type === v ? { background: "var(--surface)", color: "var(--text)", boxShadow: "0 1px 3px rgba(0,0,0,.15)" } : { color: "var(--muted)" }}>{l}</button>
      ))}
    </div>
  );

  if (type === "new_branch") {
    return (
      <div className="space-y-4">
        {toggle}
        <input type="hidden" name="type" value="new_branch" />
        <NewBranchEstimate branches={branches} employeeName={employeeName} orgName={orgName} />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {toggle}
      <h1 className="text-xl font-bold">Yangi zayavka</h1>
      <form onSubmit={onSubmit} className="card p-5 space-y-4">
        <input type="hidden" name="type" value="maintenance" />
        <div>
          <label className="label">Sarlavha</label>
          <input name="title" className="input" placeholder="Masalan: Pechim buzildi" required />
        </div>
        <div>
          <label className="label">Muhimlik</label>
          <select name="priority" className="select" defaultValue="normal">
            <option value="urgent">🔴 Shoshilinch</option>
            <option value="normal">Oddiy</option>
            <option value="low">Kam muhim</option>
          </select>
        </div>
        <div>
          <label className="label">Filial</label>
          <select name="branch_id" className="select" required>
            <option value="">— tanlang —</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}{b.status === "construction" ? " (qurilishda)" : ""}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Izoh</label>
          <textarea name="description" className="textarea" rows={3} placeholder="Batafsil ma'lumot…" />
        </div>
        <div>
          <label className="label">Rasmlar</label>
          <PhotoUpload value={photos} onChange={setPhotos} />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" className="btn btn-brand flex-1" disabled={busy}>{busy ? "Yuborilmoqda…" : "Zayavka yuborish"}</button>
          <button type="button" className="btn btn-ghost" onClick={() => router.back()}>Bekor</button>
        </div>
      </form>
    </div>
  );
}
