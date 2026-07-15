"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Camera, Images, FileText, X } from "lucide-react";
import PhotoUpload from "@/components/PhotoUpload";
import { formatNumber, parseNumber } from "@/lib/format";
import { createRequestAction } from "../actions";

interface Branch { id: number; name: string; status: string; }

// Qurilish qismlari — kelajakda Admin Sozlamalar orqali kengaytiriladi.
const PARTS = [
  "Devor", "Pol", "Shift", "Tom", "Eshik", "Oyna", "Sklad", "Elektr", "Gaz", "Suv",
  "Kanalizatsiya", "Ventilyatsiya", "Konditsioner", "Jihoz", "Stol", "Stul", "Kassa", "Ombor",
  "Reklama", "Tashqi fasad", "Ichki bezak", "Yoritish", "Internet", "Kamera", "Signalizatsiya", "Boshqa",
];
const PART_ICON: Record<string, string> = {
  Devor: "🧱", Pol: "🪵", Shift: "🏗", Tom: "🏠", Eshik: "🚪", Oyna: "🪟", Sklad: "📦", Elektr: "⚡",
  Gaz: "🔥", Suv: "🚰", Kanalizatsiya: "🚿", Ventilyatsiya: "🌬", Konditsioner: "❄️", Jihoz: "🛠",
  Stol: "🪑", Stul: "🪑", Kassa: "🧾", Ombor: "📦", Reklama: "📣", "Tashqi fasad": "🏢",
  "Ichki bezak": "🎨", Yoritish: "💡", Internet: "🌐", Kamera: "📹", Signalizatsiya: "🚨", Boshqa: "➕",
};
const iconFor = (p: string) => PART_ICON[p] ?? "🏗";

interface Row { id: number; part: string; amount: number | null; }
let nextId = 1;
const newRow = (): Row => ({ id: nextId++, part: "", amount: null });

export default function NewBranchEstimate({ branches, employeeName, orgName }: { branches: Branch[]; employeeName: string; orgName: string }) {
  const router = useRouter();
  const [branchId, setBranchId] = useState("");
  const [priority, setPriority] = useState("normal");
  const today = new Date().toISOString().slice(0, 10);
  const [createdDate, setCreatedDate] = useState(today);
  const [rows, setRows] = useState<Row[]>(() => [newRow()]);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const total = useMemo(() => rows.reduce((s, r) => s + (r.amount ?? 0), 0), [rows]);
  const branchName = branches.find((b) => String(b.id) === branchId)?.name ?? "";
  const filled = rows.filter((r) => r.part && (r.amount ?? 0) > 0);

  const setRow = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, newRow()]);
  const delRow = (id: number) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs));

  const budgetObj = () => { const o: Record<string, number> = {}; for (const r of filled) o[r.part] = (o[r.part] ?? 0) + (r.amount ?? 0); return o; };

  async function submit() {
    setError(null);
    if (!branchId) return setError("Yangi filialni tanlang.");
    if (filled.length === 0) return setError("Kamida bitta xarajat qismini kiriting.");
    setBusy(true);
    const fd = new FormData();
    fd.set("type", "new_branch");
    fd.set("title", branchName);
    fd.set("branch_id", branchId);
    fd.set("priority", priority);
    fd.set("description", description);
    fd.set("photos_json", JSON.stringify(photos));
    fd.set("estimated_amount", String(total));
    fd.set("opening_budget", JSON.stringify(budgetObj()));
    fd.set("created_date", createdDate);
    const res = await createRequestAction(null, fd);
    if (res?.error) { setError(res.error); setBusy(false); }
  }

  function generatePdf() {
    const date = new Date().toLocaleDateString("ru-RU");
    const itemRows = filled.map((r, i) => `<tr><td>${i + 1}</td><td>${r.part}</td><td class="r">${formatNumber(r.amount)} so'm</td></tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Smeta — ${branchName}</title>
    <style>
      body{font-family:Arial,sans-serif;color:#0f172a;padding:40px;max-width:800px;margin:0 auto}
      .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #2563eb;padding-bottom:16px;margin-bottom:24px}
      .brand{font-size:20px;font-weight:800;color:#2563eb}.sub{color:#64748b;font-size:12px}
      h1{font-size:18px;margin:0 0 4px}.to{color:#64748b;font-size:13px;margin-bottom:24px}
      table{width:100%;border-collapse:collapse;margin:16px 0}
      th,td{padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:left;font-size:13px}
      th{background:#f1f5f9;font-size:11px;text-transform:uppercase;color:#64748b}
      .r{text-align:right;font-variant-numeric:tabular-nums}
      .total{display:flex;justify-content:space-between;padding:14px 12px;background:#eff6ff;border-radius:8px;margin-top:8px;font-weight:800;font-size:16px;color:#2563eb}
      .meta{margin-top:32px;font-size:12px;color:#334155;line-height:1.9}
      .sign{margin-top:48px;display:flex;justify-content:space-between;font-size:13px}
    </style></head><body onload="window.print()">
      <div class="head"><div><div class="brand">${orgName}</div><div class="sub">Yangi filial — xarajat smetasi</div></div><div class="sub">Sana: ${date}</div></div>
      <h1>Yangi filial so'rovi: ${branchName}</h1>
      <div class="to">Kimga: <b>Bosh direktor (CEO)</b> — tasdiqlash uchun</div>
      <table><thead><tr><th>#</th><th>Qurilish qismi</th><th class="r">Taxminiy summa</th></tr></thead><tbody>${itemRows}</tbody></table>
      <div class="total"><span>Jami taxminiy xarajat</span><span>${formatNumber(total)} so'm</span></div>
      <div class="meta">
        Filial (loyiha): <b>${branchName}</b><br/>
        Muhimlik: <b>${priority === "urgent" ? "Shoshilinch" : priority === "low" ? "Kam muhim" : "Oddiy"}</b><br/>
        ${description ? `So'rov sababi/izoh: ${description}<br/>` : ""}
        Tayyorladi (Open Group): <b>${employeeName}</b>
      </div>
      <div class="sign"><span>Open Group: ${employeeName}</span><span>Tasdiqlayman (CEO): __________</span></div>
    </body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  }

  const sel = { background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" };

  return (
    <div className="mx-auto w-full" style={{ maxWidth: 1080 }}>
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Yangi filial so&apos;rovi</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Yangi filial uchun xarajat smetasini tayyorlash</p>
      </div>

      <div className="rounded-3xl p-6 sm:p-8" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 20px 48px -28px rgba(0,0,0,.55)" }}>
        {/* Yuqori: filial / muhimlik / sana */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="text-[13px] font-medium mb-1.5 block">Yangi filial</label>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full text-sm px-3.5 py-2.5 rounded-xl outline-none" style={sel}>
              <option value="">— filialni tanlang —</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}{b.status === "construction" ? " (qurilmoqda)" : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[13px] font-medium mb-1.5 block">Muhimlik darajasi</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full text-sm px-3.5 py-2.5 rounded-xl outline-none" style={sel}>
              <option value="normal">🟡 Oddiy</option>
              <option value="urgent">🔴 Shoshilinch</option>
              <option value="low">🟢 Kam muhim</option>
            </select>
          </div>
          <div>
            <label className="text-[13px] font-medium mb-1.5 block">Sana</label>
            <input type="date" value={createdDate} max={today} onChange={(e) => setCreatedDate(e.target.value)} className="w-full text-sm px-3.5 py-2.5 rounded-xl outline-none" style={sel} />
          </div>
        </div>

        {/* Smeta jadvali */}
        <div className="mt-7">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-semibold tracking-tight">Xarajatlar smetasi</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>Har bir qurilish qismi uchun alohida summa</p>
            </div>
            <button type="button" onClick={addRow} className="hidden sm:inline-flex items-center gap-1.5 text-[13px] font-medium px-3.5 py-2 rounded-xl transition hover:opacity-90" style={{ background: "var(--brand)", color: "var(--brand-fg)" }}><Plus size={15} /> Xarajat qo&apos;shish</button>
          </div>

          {/* Kartochkalar — desktopда 3 tadan, avtomat o'raladi. Bitta bo'lsa ham to'liq ko'rinadi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {rows.map((r, i) => (
              <div key={r.id} className="group rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", boxShadow: "0 8px 24px -18px rgba(37,99,235,.5)" }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ background: "color-mix(in srgb, var(--brand) 14%, var(--surface))" }}>{iconFor(r.part)}</span>
                    Qism {i + 1}
                  </span>
                  <button type="button" onClick={() => delRow(r.id)} className="p-1.5 rounded-lg transition opacity-60 hover:opacity-100 hover:bg-[var(--surface)]" aria-label="O'chirish"><Trash2 size={15} style={{ color: "#f87171" }} /></button>
                </div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--muted)" }}>Qurilish qismi</label>
                <select value={r.part} onChange={(e) => setRow(r.id, { part: e.target.value })} className="w-full text-sm px-3 py-2.5 rounded-xl outline-none mb-3" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
                  <option value="">— tanlang —</option>
                  {PARTS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--muted)" }}>Taxminiy summa</label>
                <div className="relative">
                  <input inputMode="numeric" value={r.amount == null ? "" : formatNumber(r.amount)} onChange={(e) => setRow(r.id, { amount: parseNumber(e.target.value) || null })}
                    placeholder="0" className="w-full text-base font-bold text-right pr-11 pl-3 py-2.5 rounded-xl outline-none tabular-nums" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px]" style={{ color: "var(--muted)" }}>so&apos;m</span>
                </div>
              </div>
            ))}

            {/* Qo'shish plitkasi — grid har doim to'ldirilgan ko'rinadi */}
            <button type="button" onClick={addRow}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--surface-2)] min-h-[168px]"
              style={{ borderColor: "color-mix(in srgb, var(--brand) 35%, var(--border))", color: "var(--brand)" }}>
              <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--brand) 14%, transparent)" }}><Plus size={20} /></span>
              <span className="text-sm font-medium">Xarajat qo&apos;shish</span>
            </button>
          </div>
        </div>

        {/* Jami */}
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-2xl px-6 py-5" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--brand) 16%, var(--surface-2)), var(--surface-2))", border: "1px solid color-mix(in srgb, var(--brand) 30%, var(--border))" }}>
          <span className="text-sm font-medium" style={{ color: "var(--muted)" }}>Jami taxminiy xarajat</span>
          <span className="text-3xl font-extrabold tabular-nums tracking-tight" style={{ color: "var(--brand)" }}>{formatNumber(total)} <span className="text-lg font-bold">so&apos;m</span></span>
        </div>

        {/* Izoh + Fayllar */}
        <div className="grid lg:grid-cols-2 gap-5 mt-6">
          <div>
            <label className="text-[13px] font-medium mb-1.5 block">Izoh <span style={{ color: "var(--muted)" }}>(ixtiyoriy)</span></label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={5} placeholder="Qo'shimcha ma'lumot (ixtiyoriy)…" className="w-full text-sm px-3.5 py-3 rounded-xl outline-none resize-none" style={sel} />
            <div className="text-[11px] text-right mt-1" style={{ color: "var(--muted)" }}>{description.length} / 500</div>
          </div>
          <div>
            <label className="text-[13px] font-medium mb-1.5 block">Hujjatlar <span style={{ color: "var(--muted)" }}>(ixtiyoriy)</span></label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {([{ Icon: Camera, lbl: "Kamera" }, { Icon: Images, lbl: "Galereya" }, { Icon: FileText, lbl: "PDF", onClick: generatePdf }] as const).map(({ Icon, lbl, ...rest }) => (
                <button key={lbl} type="button" onClick={"onClick" in rest ? rest.onClick : undefined}
                  className="flex flex-col items-center gap-1.5 py-3.5 rounded-2xl transition hover:bg-[var(--surface)]" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                  <Icon size={20} style={{ color: "var(--brand)" }} />
                  <span className="text-[11px] font-medium">{lbl}</span>
                </button>
              ))}
            </div>
            <PhotoUpload value={photos} onChange={setPhotos} />
            <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>PDF — CEO&apos;ga rasmiy smeta hujjatini yaratadi.</p>
          </div>
        </div>

        {error && (
          <div className="mt-5 flex items-center gap-2 text-sm rounded-xl px-4 py-3" style={{ background: "#ef444414", border: "1px solid #ef444433", color: "#f87171" }}>
            <X size={16} /> {error}
          </div>
        )}

        {/* Amallar */}
        <div className="mt-7 flex items-center justify-end gap-3">
          <button type="button" onClick={() => router.back()} className="px-5 py-2.5 rounded-xl text-sm font-medium transition hover:bg-[var(--surface-2)]" style={{ border: "1px solid var(--border)" }}>Bekor qilish</button>
          <button type="button" onClick={submit} disabled={busy} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: "linear-gradient(135deg,#2563eb,#4f8ef7)", boxShadow: "0 10px 24px -10px rgba(37,99,235,.7)" }}>
            {busy ? "Yuborilmoqda…" : "CEO ga yuborish"}
          </button>
        </div>
      </div>
    </div>
  );
}
