// =============================================================================
// Ochilish moduli — bosqich shabloni (plugin arxitektura, hardcode YO'Q).
//
// Progress bosqichlar SONIga emas, VAZNIga qarab hisoblanadi (talab #7):
// remont 22%, jihoz 18%, elektr 12% ... Har bosqichning o'z vazni bor.
//
// Vaznlar hozircha shu yerda (default shablon). Kelajakda Admin Sozlamalar
// orqali yangi shablon/vazn qo'shadi — `resolveTemplate(overrides)` shu uchun
// tayyor: DB'dagi qiymatlar kelsa, defaultni buzmasdan ustidan yoziladi.
// =============================================================================

import { OPENING_STAGES_FULL } from "@/lib/constants";

export interface StageDef { key: string; label: string; weight: number }

// Default vaznlar (yig'indisi 100). "opened" — natija bosqichi, vazni 0.
const DEFAULT_WEIGHTS: Record<string, number> = {
  project: 2, rent: 6, repair: 22, electric: 12, gas: 4, water: 3, internet: 4,
  equipment: 18, kitchen: 10, camera: 3, iiko: 3, ads: 4, staff: 5, test: 4, opened: 0,
};

// Default shablon — constants'dagi bosqich ro'yxatidan quriladi (yagona manba).
export const OPENING_TEMPLATE: StageDef[] = OPENING_STAGES_FULL.map((s) => ({
  key: s.key, label: s.label, weight: DEFAULT_WEIGHTS[s.key] ?? 0,
}));

/**
 * Shablonni yechish — kelajakda Sozlamalardagi vaznlar (yoki boshqa shablon)
 * shu yerda defaultning ustidan yoziladi. Hozircha default qaytaradi.
 */
export function resolveTemplate(overrides?: Record<string, number> | null): StageDef[] {
  if (!overrides) return OPENING_TEMPLATE;
  return OPENING_TEMPLATE.map((s) => ({ ...s, weight: overrides[s.key] ?? s.weight }));
}

/**
 * Vaznli progress (0–100). Bajarilgan bosqichlar vaznlari yig'indisi /
 * umumiy vazn. Bosqichlar SONI emas — VAZNI hisobga olinadi.
 */
export function weightedProgress(done: Record<string, boolean> | null | undefined, template: StageDef[] = OPENING_TEMPLATE): number {
  const total = template.reduce((s, x) => s + x.weight, 0);
  if (total <= 0) return 0;
  const got = template.reduce((s, x) => s + (done?.[x.key] ? x.weight : 0), 0);
  return Math.round((got / total) * 100);
}
