// AI Risk qoidalari — har biri mustaqil, real ma'lumotdan xulosa chiqaradi.
// Yangi qoida qo'shish uchun: RiskRule yozing va RULES ga qo'shing.
import { type RiskRule, norm } from "./types";
import { isOpen, isClosed } from "@/lib/helpers";
import { PRICE_OVER_RATIO, REPEAT_WINDOW_DAYS, REPEAT_MIN_COUNT } from "./purchase";

// 1-xavf: limit ishlatilishi (90% xavf, 100%+ kritik)
export const limitUsageRule: RiskRule = {
  id: "limit",
  label: "Limit xavfi",
  evaluate({ limit, spent }) {
    if (limit <= 0) return null;
    const pct = Math.round((spent / limit) * 100);
    if (pct >= 100) return { ruleId: "limit", level: "critical", score: 40, title: "Byudjet limiti oshib ketgan", detail: `Byudjet limiti oshib ketgan — oylik limitning ${pct}% ishlatilgan.` };
    if (pct >= 90) return { ruleId: "limit", level: "risk", score: 28, title: "Limit deyarli tugadi", detail: `Oylik limitning ${pct}% ishlatilgan.` };
    if (pct >= 75) return { ruleId: "limit", level: "attention", score: 14, title: "Limitga yaqinlashmoqda", detail: `Oylik limitning ${pct}% ishlatilgan.` };
    return null;
  },
};

// 2-xavf: bozor narxidan qimmat (eng arzon narx bilan solishtirish)
export const priceAnomalyRule: RiskRule = {
  id: "price",
  label: "Narx xavfi",
  evaluate({ purchases, benchmarkMin }) {
    let worstName = "", worstOver = 0;
    for (const p of purchases) {
      const min = benchmarkMin.get(norm(p.name));
      if (min && min > 0 && p.price > min * PRICE_OVER_RATIO) {
        const over = Math.round(((p.price - min) / min) * 100);
        if (over > worstOver) { worstOver = over; worstName = p.name; }
      }
    }
    if (!worstName) return null;
    const level = worstOver >= 100 ? "critical" : worstOver >= 50 ? "risk" : "attention";
    return { ruleId: "price", level, score: Math.min(30, Math.round(worstOver / 3)), title: `${worstName} — narx anomaliyasi`, detail: `Mahsulot odatdagi narxdan ${worstOver}% qimmat sotib olingan.` };
  },
};

// 3-xavf: bir mahsulot qisqa vaqtда ko'p marta xarid qilingan
export const repeatPurchaseRule: RiskRule = {
  id: "repeat",
  label: "Takroriy xarid",
  evaluate({ purchases, now }) {
    const windowMs = REPEAT_WINDOW_DAYS * 86_400_000;
    const byName = new Map<string, { count: number; name: string }>();
    for (const p of purchases) {
      if (now.getTime() - new Date(p.at).getTime() > windowMs) continue;
      const k = norm(p.name);
      const e = byName.get(k) ?? { count: 0, name: p.name };
      e.count++; byName.set(k, e);
    }
    let worst: { count: number; name: string } | null = null;
    for (const e of byName.values()) if (e.count >= REPEAT_MIN_COUNT && (!worst || e.count > worst.count)) worst = e;
    if (!worst) return null;
    return { ruleId: "repeat", level: "risk", score: Math.min(20, worst.count * 3), title: `${worst.name} — takroriy xarid`, detail: `Bir xil mahsulot qisqa vaqt ichida ${worst.count} marta xarid qilingan. Takroriy xarid ehtimoli mavjud.` };
  },
};

// 4-xavf: cheklar / foto hisobot / yakuniy hisobot to'liq emas
export const missingDocsRule: RiskRule = {
  id: "docs",
  label: "Hujjat muammolari",
  evaluate({ requests }) {
    // Ish bajarilib bo'lgan (yopilgan) yoki jarayondagi zayavkalarda hujjat kutiladi
    const bad = requests.filter((r) => (isClosed(r.status) || isOpen(r.status)) && r.status !== "rejected" && (!r.hasReport || !r.hasPhotos));
    if (bad.length === 0) return null;
    return { ruleId: "docs", level: "critical", score: Math.min(30, bad.length * 12), title: "Hujjatlar to'liq emas", detail: `${bad.length} ta zayavkada foto hisobot yoki chek biriktirilmagan.` };
  },
};

export const RULES: RiskRule[] = [limitUsageRule, priceAnomalyRule, repeatPurchaseRule, missingDocsRule];
