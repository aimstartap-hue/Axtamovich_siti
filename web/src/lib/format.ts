// =============================================================================
// Raqam / pul formati — butun ilova uchun yagona qoida.
// Mingliklar PROBEL bilan ajratiladi: 10 000, 1 500 000
// =============================================================================

/** 1500000 -> "1 500 000" (butun son, probel bilan) */
export function formatNumber(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "";
  const num = typeof n === "string" ? Number(n.replace(/\s/g, "")) : n;
  if (isNaN(num)) return "";
  const neg = num < 0;
  const s = Math.abs(Math.round(num)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return neg ? "-" + s : s;
}

/** "1 500 000" yoki "1500000" -> 1500000 (probel/harflarni tozalaydi) */
export function parseNumber(s: string | null | undefined): number {
  if (!s) return 0;
  const cleaned = String(s).replace(/[^\d.-]/g, "");
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
}

/** Pul: "1 500 000 so'm" */
export function formatMoney(n: number | null | undefined, currency = "so'm"): string {
  if (n === null || n === undefined) return "—";
  return `${formatNumber(n)} ${currency}`;
}
