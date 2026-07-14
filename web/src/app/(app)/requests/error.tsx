"use client";

import { useEffect } from "react";
import { TriangleAlert, RotateCw } from "lucide-react";
import { logError } from "@/lib/logError";

// Zayavkalar sahifasi error holati — qayta urinish bilan.
export default function RequestsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { logError("requests-page", error); }, [error]);

  return (
    <div className="rounded-2xl p-12 flex flex-col items-center gap-3 text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <TriangleAlert size={40} style={{ color: "#f87171" }} />
      <div className="text-sm font-medium">Zayavkalarni yuklashda xatolik</div>
      <div className="text-xs max-w-sm" style={{ color: "var(--muted)" }}>Ma&apos;lumotlarni olishda muammo yuz berdi. Qayta urinib ko&apos;ring.</div>
      <button onClick={reset} className="btn btn-brand flex items-center gap-1.5 !py-2 mt-1"><RotateCw size={15} /> Qayta urinish</button>
    </div>
  );
}
