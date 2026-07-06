"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PhotoUpload from "@/components/PhotoUpload";
import { createRequestAction } from "../actions";
import { REQUEST_TYPES } from "@/lib/constants";

interface Branch { id: number; name: string; status: string; }

export default function NewRequestForm({
  branches, canMaintenance, canNewBranch,
}: {
  branches: Branch[];
  canMaintenance: boolean;
  canNewBranch: boolean;
}) {
  const router = useRouter();
  const [type, setType] = useState(canMaintenance ? "maintenance" : "new_branch");
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
    // muvaffaqiyatda action redirect qiladi
  }

  return (
    <form onSubmit={onSubmit} className="card p-5 space-y-4">
      <div>
        <label className="label">Tur</label>
        <select name="type" className="select" value={type} onChange={(e) => setType(e.target.value)}>
          {canMaintenance && <option value="maintenance">{REQUEST_TYPES.maintenance}</option>}
          {canNewBranch && <option value="new_branch">{REQUEST_TYPES.new_branch}</option>}
        </select>
      </div>

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

      {type === "maintenance" && (
        <div>
          <label className="label">Filial</label>
          <select name="branch_id" className="select" required>
            <option value="">— tanlang —</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}{b.status === "construction" ? " (qurilishda)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

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
        <button type="submit" className="btn btn-brand flex-1" disabled={busy}>
          {busy ? "Yuborilmoqda…" : "Zayavka yuborish"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => router.back()}>Bekor</button>
      </div>
    </form>
  );
}
