// =============================================================================
// Moliya "Diqqat talab qiladi" — real ma'lumotdan anomaliya aniqlash (AI tahlil).
// Sof funksiya (I/O yo'q) — test qilinadi. Fake alert yo'q: har bir ogohlantirish
// haqiqiy report_items / byudjet / davr ma'lumotidan kelib chiqadi.
// =============================================================================
import { formatMoney, formatNumber } from "@/lib/format";

export type Sev = "critical" | "serious" | "warning";
export interface HistoryRow { date: string; price: number; who: string | null; supplier: string | null; branch: string | null }
export interface Anomaly { sev: Sev; title: string; detail: string; href?: string; history?: HistoryRow[] }

export interface AItem {
  name: string;
  category: string | null;
  supplier: string | null;
  qty: number;
  price: number;
  who: string | null;
  report: { created_at: string; request: { branch_id: number | null } | null } | null;
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
const pct = (a: number, b: number) => Math.round(((a - b) / b) * 100);

/**
 * Real xarid tarixidan anomaliyalarni topadi:
 *  1) Narx sakrashi (oxirgi ikki xarid, +30% / kritik +200%)
 *  2) Eng arzon ta'minotchidan qimmat
 *  3) Bir mahsulot filiallarda keskin farq (+40%)
 *  4) Ta'minotchi konsentratsiyasi (>55%)
 *  5) Kategoriya keskin oshdi (+40% oldingi davrga)
 *  6) Byudjetdan oshgan filial
 *  7) Umumiy xarajat keskin oshdi
 * Severity bo'yicha saralanadi (kritik birinchi).
 */
export function buildAnomalies(
  items: AItem[],
  branchName: Map<number, string>,
  budgetByBranch: Map<number, number>,
  spentByBranch: Map<number, number>,
  catCur: Map<string, number>,
  catPrev: Map<string, number>,
  totalCur: number,
  totalPrev: number,
): Anomaly[] {
  const out: Anomaly[] = [];

  // Mahsulot (kategoriya+nom) bo'yicha xaridlar tarixi
  const hist = new Map<string, { price: number; date: string; supplier: string | null; branch: number | null; who: string | null }[]>();
  const nameOf = new Map<string, string>();
  for (const it of items) {
    if (!it.report || !it.name) continue;
    const key = `${norm(it.name)}|${norm(it.category)}`;
    if (!hist.has(key)) { hist.set(key, []); nameOf.set(key, it.name); }
    hist.get(key)!.push({ price: Number(it.price) || 0, date: it.report.created_at, supplier: it.supplier, branch: it.report.request?.branch_id ?? null, who: it.who });
  }

  for (const [key, raw] of hist) {
    const arr = raw.filter((x) => x.date && x.price > 0).sort((a, b) => (a.date > b.date ? 1 : -1));
    if (arr.length < 2) continue;
    const name = nameOf.get(key) ?? "Mahsulot";
    const prev = arr[arr.length - 2].price, curr = arr[arr.length - 1].price;
    // Shu mahsulotning to'liq xarid tarixi (drawer'da hisobot ko'rinishida)
    const history: HistoryRow[] = arr.map((x) => ({ date: x.date, price: x.price, who: x.who, supplier: x.supplier, branch: x.branch != null ? branchName.get(x.branch) ?? null : null }));
    // 1) Narx sakrashi (oxirgi ikki xarid)
    if (curr > prev * 1.3) out.push({ sev: curr > prev * 3 ? "critical" : "serious", title: `${name} — narx oshdi`, detail: `${formatNumber(prev)} → ${formatNumber(curr)} so'm (+${pct(curr, prev)}%)`, history });
    // 2) Eng arzon ta'minotchidan qimmat
    const cheap = arr.reduce((m, x) => (x.price < m.price ? x : m), arr[0]);
    if (cheap.supplier && curr > cheap.price * 1.2) out.push({ sev: curr > cheap.price * 1.5 ? "critical" : "serious", title: `${name} — eng arzon narxdan qimmat`, detail: `Eng arzon ${formatNumber(cheap.price)} (${cheap.supplier}) → hozir ${formatNumber(curr)} (+${pct(curr, cheap.price)}%)`, history });
    // 3) Filiallararo keskin farq
    const bp = arr.filter((x) => x.branch != null);
    if (bp.length >= 2) {
      const min = bp.reduce((m, x) => (x.price < m.price ? x : m), bp[0]);
      const mx = bp.reduce((m, x) => (x.price > m.price ? x : m), bp[0]);
      if (min.branch !== mx.branch && mx.price > min.price * 1.4)
        out.push({ sev: "serious", title: `${name} — filiallarda keskin farq`, detail: `${branchName.get(min.branch!) ?? "?"}: ${formatNumber(min.price)} · ${branchName.get(mx.branch!) ?? "?"}: ${formatNumber(mx.price)} (+${pct(mx.price, min.price)}%)`, history });
    }
  }

  // 4) Ta'minotchi konsentratsiyasi
  const bySupplier = new Map<string, number>();
  let itemsTotal = 0;
  for (const it of items) { const v = (Number(it.qty) || 0) * (Number(it.price) || 0); itemsTotal += v; if (it.supplier?.trim()) bySupplier.set(it.supplier.trim(), (bySupplier.get(it.supplier.trim()) ?? 0) + v); }
  const topSup = [...bySupplier.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topSup && itemsTotal > 0 && topSup[1] > itemsTotal * 0.55)
    out.push({ sev: "warning", title: `Ta'minotchi konsentratsiyasi: ${topSup[0]}`, detail: `Umumiy xaridning ${Math.round((topSup[1] / itemsTotal) * 100)}% shu ta'minotchidan` });

  // 5) Kategoriya xarajati keskin oshdi
  for (const [cat, cur] of catCur) { const p = catPrev.get(cat) ?? 0; if (p > 0 && cur > p * 1.4) out.push({ sev: "warning", title: `"${cat}" kategoriyasi oshdi`, detail: `Oldingi davrga nisbatan +${pct(cur, p)}% (${formatMoney(cur)})` }); }

  // 6) Byudjetdan oshgan filiallar
  for (const [bid, bud] of budgetByBranch) { const sp = spentByBranch.get(bid) ?? 0; if (bud > 0 && sp > bud) out.push({ sev: "critical", title: `${branchName.get(bid) ?? "Filial"} — byudjetdan oshdi`, detail: `+${formatMoney(sp - bud)} (${formatMoney(sp)} / ${formatMoney(bud)})`, href: "/budgets" }); }

  // 7) Umumiy oshish
  if (totalPrev > 0 && totalCur > totalPrev * 1.4) out.push({ sev: "warning", title: "Umumiy xarajat sezilarli oshdi", detail: `Bu davr oldingi davrga nisbatan +${pct(totalCur, totalPrev)}%` });

  const rank = { critical: 0, serious: 1, warning: 2 };
  return out.sort((a, b) => rank[a.sev] - rank[b.sev]).slice(0, 12);
}
