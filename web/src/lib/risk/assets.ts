// =============================================================================
// Aktiv (asset) AI risk qoidalari — kengaytiriladigan. Mavjud engine infratuzilmasi
// (RiskFinding + finalize) qayta ishlatiladi. Yangi qoida = funksiya + ASSET_RULES.
// =============================================================================
import { type RiskFinding, type RiskResult } from "./types";
import { finalize } from "./engine";
import { formatMoney } from "@/lib/format";

export const INVENTORY_STALE_DAYS = 180;
export const MANY_TRANSFERS = 3;

export interface AssetRiskContext {
  price: number;
  hasPhoto: boolean;
  hasDocs: boolean;           // nakladnoy/hujjat
  hasAssignee: boolean;
  lastInventoryAt: string | null;
  warrantyUntil: string | null;
  transferCount: number;
  repairTotal: number;
  expensiveThreshold: number; // "qimmat aktiv" chegarasi (org_settings)
  now: Date;
}

export type AssetRule = (c: AssetRiskContext) => RiskFinding | RiskFinding[] | null;
const daysSince = (iso: string, now: Date) => Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);

// 1) Inventarizatsiya
export const inventoryRule: AssetRule = (c) => {
  if (!c.lastInventoryAt) return { ruleId: "inventory", level: "risk", score: 22, title: "Inventarizatsiya qilinmagan", detail: "Aktiv hali birorta inventarizatsiyadan o'tmagan." };
  const d = daysSince(c.lastInventoryAt, c.now);
  if (d > INVENTORY_STALE_DAYS) return { ruleId: "inventory", level: d > 365 ? "risk" : "attention", score: Math.min(22, Math.round(d / 20)), title: "Inventarizatsiya eskirgan", detail: `Oxirgi inventarizatsiyadan ${d} kun o'tgan.` };
  return null;
};
// 2) Foto
export const photoRule: AssetRule = (c) => (c.hasPhoto ? null : { ruleId: "photo", level: "attention", score: 8, title: "Foto yo'q", detail: "Aktiv uchun foto biriktirilmagan." });
// 3) Nakladnoy/hujjat
export const docsRule: AssetRule = (c) => (c.hasDocs ? null : { ruleId: "docs", level: "attention", score: 10, title: "Nakladnoy yo'q", detail: "Aktivga nakladnoy yoki hujjat biriktirilmagan." });
// 4) Mas'ul
export const assigneeRule: AssetRule = (c) => (c.hasAssignee ? null : { ruleId: "assignee", level: "attention", score: 12, title: "Mas'ul belgilanmagan", detail: "Aktivga mas'ul shaxs biriktirilmagan." });
// 5) Ko'p ko'chirilgan
export const transferRule: AssetRule = (c) => (c.transferCount >= MANY_TRANSFERS ? { ruleId: "transfer", level: "risk", score: Math.min(18, c.transferCount * 4), title: "Ko'p marta ko'chirilgan", detail: `Aktiv ${c.transferCount} marta filial/mas'ul almashtirgan.` } : null);
// 6) Qimmat aktiv nazoratsiz
export const expensiveRule: AssetRule = (c) => (c.price >= c.expensiveThreshold && (!c.hasAssignee || !c.lastInventoryAt) ? { ruleId: "expensive", level: "critical", score: 30, title: "Qimmat aktiv nazoratsiz", detail: `Narxi ${formatMoney(c.price)} — mas'ul yoki inventarizatsiya yo'q.` } : null);
// 7) Kafolat tugagan
export const warrantyRule: AssetRule = (c) => (c.warrantyUntil && new Date(c.warrantyUntil).getTime() < c.now.getTime() ? { ruleId: "warranty", level: "attention", score: 6, title: "Kafolat tugagan", detail: "Aktiv kafolat muddati tugagan." } : null);
// 8) Ta'mir narxi aktiv narxidan yuqori
export const repairRule: AssetRule = (c) => (c.price > 0 && c.repairTotal > c.price ? { ruleId: "repair", level: "critical", score: 26, title: "Ta'mir narxi juda yuqori", detail: `Ta'mir xarajati (${formatMoney(c.repairTotal)}) aktiv narxidan (${formatMoney(c.price)}) yuqori.` } : null);

export const ASSET_RULES: AssetRule[] = [inventoryRule, photoRule, docsRule, assigneeRule, transferRule, expensiveRule, warrantyRule, repairRule];

/** Aktiv uchun risk natijasi (kengaytirish uchun rules parametri). */
export function evaluateAssetRisk(c: AssetRiskContext, rules: AssetRule[] = ASSET_RULES): RiskResult {
  const findings: RiskFinding[] = [];
  for (const r of rules) { const f = r(c); if (f) Array.isArray(f) ? findings.push(...f) : findings.push(f); }
  return finalize(findings);
}
