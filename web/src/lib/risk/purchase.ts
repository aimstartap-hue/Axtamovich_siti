// Per-item (xarid darajasida) risk primitivlari — YAGONA manba.
// Ham pozitsiya (aggregate) qoidalari, ham zayavka/xarid tahlili shu funksiyalarni
// ishlatadi (dublikat yo'q). Chegaralar shu yerda — bir joyda o'zgartiriladi.
import { type RiskFinding, norm } from "./types";
import { formatMoney } from "@/lib/format";

export const PRICE_OVER_RATIO = 1.3;      // eng arzon narxdan 30%+ = anomaliya
export const PRICE_CRITICAL_RATIO = 3;    // 3x+ = kritik
export const REPEAT_WINDOW_DAYS = 15;
export const REPEAT_MIN_COUNT = 4;

/** Bitta xarid narxi eng arzon narxdan qimmatmi? */
export function priceFinding(name: string, price: number, benchmarkMin: Map<string, number>): RiskFinding | null {
  const min = benchmarkMin.get(norm(name));
  if (min == null || min <= 0 || price <= min * PRICE_OVER_RATIO) return null;
  const over = Math.round(((price - min) / min) * 100);
  const level = over >= 100 ? "critical" : over >= 50 ? "risk" : "attention";
  return { ruleId: "price", level, score: Math.min(30, Math.round(over / 3)), title: `${name} — narx anomaliyasi`, detail: `Bozor narxidan ${over}% qimmat olingan (eng arzon: ${formatMoney(min)}).` };
}

/** Mahsulot oyna ichida ko'p marta olinganmi? (count — 15 kunlik son) */
export function repeatFinding(name: string, count: number): RiskFinding | null {
  if (count < REPEAT_MIN_COUNT) return null;
  return { ruleId: "repeat", level: "risk", score: Math.min(20, count * 3), title: `${name} — takroriy xarid`, detail: `Bu mahsulot ${REPEAT_WINDOW_DAYS} kun ichida ${count} marta xarid qilingan.` };
}

/** Hujjat to'liqligi (chek/foto hisobot). */
export function docsFindings(hasReport: boolean, hasPhotos: boolean): RiskFinding[] {
  if (!hasReport) return [{ ruleId: "docs", level: "critical", score: 20, title: "Hujjat to'liq emas", detail: "Hisobot / chek biriktirilmagan." }];
  if (!hasPhotos) return [{ ruleId: "docs", level: "attention", score: 8, title: "Foto hisobot yo'q", detail: "Foto hisobot yuklanmagan." }];
  return [];
}
