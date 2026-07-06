"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Rasmlarni siqib Supabase Storage ('photos') ga yuklaydi, URL ro'yxatini qaytaradi. */
export default function PhotoUpload({
  value, onChange,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const supabase = createClient();

  async function compress(file: File): Promise<Blob> {
    const bmp = await createImageBitmap(file);
    const max = 1280;
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    return await new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.8));
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const urls: string[] = [...value];
    for (const file of Array.from(files)) {
      try {
        const blob = await compress(file);
        const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { data, error } = await supabase.storage.from("photos").upload(name, blob, {
          contentType: "image/jpeg",
        });
        if (!error && data) {
          const { data: pub } = supabase.storage.from("photos").getPublicUrl(data.path);
          urls.push(pub.publicUrl);
        }
      } catch { /* skip */ }
    }
    onChange(urls);
    setBusy(false);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map((u, i) => (
          <div key={i} className="relative w-20 h-20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" className="w-20 h-20 object-cover rounded-lg border border-border" />
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="absolute -top-2 -right-2 bg-danger text-white rounded-full w-5 h-5 text-xs">×</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        {/* Galereya (telefonda rasmlar, kompyuterda fayl tanlash) */}
        <label className="btn btn-ghost cursor-pointer">
          {busy ? "Yuklanmoqda…" : "🖼 Galereya"}
          <input type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => handleFiles(e.target.files)} disabled={busy} />
        </label>
        {/* Kamera (telefonda to'g'ridan-to'g'ri suratga olish) */}
        <label className="btn btn-ghost cursor-pointer">
          📷 Kamera
          <input type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => handleFiles(e.target.files)} disabled={busy} />
        </label>
      </div>
    </div>
  );
}
