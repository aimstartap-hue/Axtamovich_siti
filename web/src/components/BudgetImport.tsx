"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { formatMoney } from "@/lib/format";

type Branch = { id: number; name: string };
type Row = { branch_id: number; category: string; amount: number; branchName: string };

/**
 * Excel (.xlsx/.csv) dan byudjet import (punkt 20).
 * Kutilgan ustunlar: "Filial" (nomi), "Kategoriya" (ixtiyoriy), "Summa".
 * Faylni brauzerда o'qiydi, filial nomini id ga moslaydi, so'ng serverga yuboradi.
 */
export default function BudgetImport({
  branches, month, action,
}: {
  branches: Branch[];
  month: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const byName = new Map(branches.map((b) => [b.name.trim().toLowerCase(), b.id]));

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null); setRows([]);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const parsed: Row[] = [];
      const unknown: string[] = [];
      for (const r of raw) {
        const keys = Object.keys(r);
        const get = (names: string[]) => {
          const k = keys.find((kk) => names.some((n) => kk.trim().toLowerCase().includes(n)));
          return k ? String(r[k]) : "";
        };
        const branchName = get(["filial", "branch", "точка", "филиал"]).trim();
        const category = get(["kategor", "категор", "modda"]).trim();
        const amount = Number(String(get(["summa", "byudjet", "сумма", "бюджет", "amount"])).replace(/[^\d.]/g, ""));
        if (!branchName || !amount) continue;
        const id = byName.get(branchName.toLowerCase());
        if (!id) { if (!unknown.includes(branchName)) unknown.push(branchName); continue; }
        parsed.push({ branch_id: id, category, amount, branchName });
      }
      if (!parsed.length) setError("Mos qator topilmadi. Ustunlar: Filial, Kategoriya (ixtiyoriy), Summa.");
      else if (unknown.length) setError(`Topilmagan filiallar: ${unknown.join(", ")} (o'tkazib yuborildi).`);
      setRows(parsed);
    } catch {
      setError("Faylni o'qib bo'lmadi. .xlsx yoki .csv bo'lishi kerak.");
    }
  }

  async function submit() {
    setBusy(true);
    const fd = new FormData();
    fd.set("month", month);
    fd.set("rows_json", JSON.stringify(rows.map((r) => ({ branch_id: r.branch_id, category: r.category, amount: r.amount }))));
    await action(fd);
    setRows([]); setBusy(false);
  }

  return (
    <details className="card p-4">
      <summary className="cursor-pointer font-medium">⬆ Excel'dan import (.xlsx)</summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-muted">Ustunlar: <b>Filial</b>, <b>Kategoriya</b> (ixtiyoriy), <b>Summa</b>. Joriy oy ({month}) ga yoziladi.</p>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="text-sm" />
        {error && <p className="text-sm text-danger">{error}</p>}
        {rows.length > 0 && (
          <>
            <div className="text-sm">{rows.length} qator tayyor:</div>
            <div className="max-h-40 overflow-y-auto text-xs space-y-1">
              {rows.map((r, i) => (
                <div key={i} className="flex justify-between border-b border-border pb-0.5">
                  <span>{r.branchName}{r.category ? ` · ${r.category}` : ""}</span>
                  <span>{formatMoney(r.amount)}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-brand" disabled={busy} onClick={submit}>
              {busy ? "Yuklanmoqda…" : `${rows.length} byudjetni saqlash`}
            </button>
          </>
        )}
      </div>
    </details>
  );
}
