// AI Risk dvigateli — qoidalarni ishga tushirib umumiy ball va daraja chiqaradi.
import { type RiskContext, type RiskResult, type RiskRule, type RiskLevel, type RiskFinding } from "./types";
import { RULES } from "./rules";

export { LEVEL_META } from "./types";

const ORDER: RiskLevel[] = ["good", "attention", "risk", "critical"];
const rank = (l: RiskLevel) => ORDER.indexOf(l);

export function worstLevel(levels: RiskLevel[]): RiskLevel {
  return levels.reduce<RiskLevel>((a, b) => (rank(b) > rank(a) ? b : a), "good");
}

/** Topilmalardan AI xulosasi/tavsiyasi (hardcode emas — mavjud xavflardan). */
export function concludeFindings(findings: RiskFinding[]): string {
  if (findings.length === 0) return "Xavf aniqlanmadi. Xarajatlar nazorat ostida.";
  const ids = new Set(findings.map((f) => f.ruleId));
  const parts: string[] = [];
  if (ids.has("expensive") || ids.has("repair")) parts.push("Qimmat aktivni nazoratga olib, ta'mir xarajatlarini qayta ko'rib chiqish tavsiya etiladi.");
  if (ids.has("inventory")) parts.push("Aktivni tezkor inventarizatsiyadan o'tkazish talab qilinadi.");
  if (ids.has("assignee")) parts.push("Aktivga mas'ul shaxs biriktirish kerak.");
  if (ids.has("transfer")) parts.push("Aktivning tez-tez ko'chirilishi sababini tekshirish tavsiya etiladi.");
  if (ids.has("docs")) parts.push("Foto hisobot, chek va nakladnoylarni to'liq biriktirish talab qilinadi.");
  if (ids.has("price")) parts.push("Narxlar bozor darajasidan yuqori — tasdiqlashdan oldin qayta solishtirish tavsiya etiladi.");
  if (ids.has("repeat")) parts.push("Takroriy xaridlarni birlashtirib, yagona buyurtma qilish tavsiya etiladi.");
  if (ids.has("limit")) parts.push("Limit oshib ketmasligi uchun keyingi xarajatlarni cheklash tavsiya etiladi.");
  return parts.slice(0, 3).join(" ") || "Aniqlangan xavflarni ko'rib chiqish tavsiya etiladi.";
}

/** Topilmalar ro'yxatini yakuniy RiskResult ga aylantiradi (score/level/xulosa). */
export function finalize(findings: RiskFinding[]): RiskResult {
  const sorted = [...findings].sort((a, b) => rank(b.level) - rank(a.level) || b.score - a.score);
  const score = Math.min(100, sorted.reduce((s, f) => s + f.score, 0));
  const level = sorted.length ? worstLevel(sorted.map((f) => f.level)) : "good";
  return { score, level, findings: sorted, recommendation: concludeFindings(sorted) };
}

/** Berilgan kontekst uchun risk natijasini hisoblaydi. rules — kengaytirish uchun. */
export function evaluateRisk(ctx: RiskContext, rules: RiskRule[] = RULES): RiskResult {
  const findings: RiskFinding[] = [];
  for (const r of rules) {
    const f = r.evaluate(ctx);
    if (f) findings.push(f);
  }
  return finalize(findings);
}
