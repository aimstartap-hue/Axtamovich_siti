"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

export const SECTIONS: { id: string; label: string; hint: string }[] = [
  { id: "org", label: "Tashkilot", hint: "Kompaniya nomi, STIR, valyuta, vaqt zonasi" },
  { id: "users", label: "Foydalanuvchilar", hint: "Xodimlar, rollar, filialga biriktirish" },
  { id: "perms", label: "Ruxsatlar", hint: "Rol matritsasi — kim nima qila oladi" },
  { id: "branches", label: "Filiallar", hint: "Filial qo'shish, status, manager" },
  { id: "finance", label: "Moliyaviy sozlamalar", hint: "QQS, byudjet qoidalari, limit foizlari" },
  { id: "ai", label: "AI sozlamalari", hint: "Risk qoidalari, narx anomaliyasi, limit %" },
  { id: "docs", label: "Hujjat talablari", hint: "Chek, foto, nakladnoy, tilxat limiti" },
  { id: "notify", label: "Bildirishnomalar", hint: "Telegram, Email, Push, SMS" },
  { id: "integrations", label: "Integratsiyalar", hint: "IIKO, Telegram Bot, SMTP, API kalit" },
  { id: "audit", label: "Audit va loglar", hint: "Kim, qachon, nima o'zgartirdi" },
  { id: "backup", label: "Backup", hint: "Zaxira nusxa, tiklash tarixi" },
  { id: "system", label: "Tizim", hint: "Cache, versiya, health check" },
  { id: "plugins", label: "Plugin Manager", hint: "Modullarni yoqish/o'chirish" },
];

export default function SettingsSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); ref.current?.focus(); setOpen(true); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = q.trim() ? SECTIONS.filter((s) => (s.label + s.hint).toLowerCase().includes(q.toLowerCase())) : SECTIONS;
  const go = (id: string) => { document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); setOpen(false); setQ(""); ref.current?.blur(); };

  return (
    <div className="relative w-full max-w-md">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
      <input ref={ref} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Sozlamalarda qidirish…" className="w-full text-sm pl-9 pr-14 py-2 rounded-xl outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }} />
      <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}>Ctrl K</kbd>
      {open && results.length > 0 && (
        <div className="absolute z-30 mt-1.5 w-full rounded-xl overflow-hidden shadow-xl max-h-80 overflow-y-auto" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {results.map((s) => (
            <button key={s.id} onMouseDown={(e) => { e.preventDefault(); go(s.id); }} className="w-full text-left px-3 py-2 hover:bg-surface-2 transition">
              <div className="text-sm font-medium">{s.label}</div>
              <div className="text-[11px]" style={{ color: "var(--muted)" }}>{s.hint}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
