"use client";

/**
 * CSV eksport tugmasi (punkt 14). Ma'lumotni brauzerда CSV qilib yuklaydi.
 * Excel'да kirillcha to'g'ri ko'rinishi uchun UTF-8 BOM qo'shiladi.
 */
export default function ExportCsv({
  filename, headers, rows, label = "⬇ Excel (CSV)",
}: {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
  label?: string;
}) {
  function download() {
    const esc = (v: string | number) => {
      const s = String(v ?? "");
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers, ...rows].map((r) => r.map(esc).join(";")).join("\r\n");
    const blob = new Blob(["﻿" + lines], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button type="button" onClick={download} className="btn btn-ghost !py-1 text-sm">
      {label}
    </button>
  );
}
