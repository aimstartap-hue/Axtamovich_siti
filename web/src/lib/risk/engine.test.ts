import { describe, it, expect } from "vitest";
import { evaluateRisk, worstLevel } from "./engine";
import { limitUsageRule, priceAnomalyRule, repeatPurchaseRule, missingDocsRule, RULES } from "./rules";
import type { RiskContext, Purchase, RequestDoc } from "./types";

const NOW = new Date("2026-07-13T10:00:00Z");
const ctx = (over: Partial<RiskContext> = {}): RiskContext => ({
  limit: 0, spent: 0, purchases: [], benchmarkMin: new Map(), requests: [], now: NOW, ...over,
});
const buy = (name: string, price: number, at: string, qty = 1): Purchase => ({ name, price, qty, at });
const req = (id: number, status: string, hasReport: boolean, hasPhotos: boolean): RequestDoc => ({ id, status, hasReport, hasPhotos });

describe("limitUsageRule", () => {
  it("90% -> risk, 100%+ -> kritik, 75% -> diqqat, past -> null", () => {
    expect(limitUsageRule.evaluate(ctx({ limit: 100, spent: 92 }))?.level).toBe("risk");
    expect(limitUsageRule.evaluate(ctx({ limit: 100, spent: 130 }))?.level).toBe("critical");
    expect(limitUsageRule.evaluate(ctx({ limit: 100, spent: 78 }))?.level).toBe("attention");
    expect(limitUsageRule.evaluate(ctx({ limit: 100, spent: 40 }))).toBeNull();
    expect(limitUsageRule.evaluate(ctx({ limit: 0, spent: 40 }))).toBeNull();
  });
});

describe("priceAnomalyRule", () => {
  it("eng arzon narxdan 30%+ qimmat -> topilma, foizni hisoblaydi", () => {
    const benchmarkMin = new Map([["pech", 8_000_000]]);
    const f = priceAnomalyRule.evaluate(ctx({ purchases: [buy("Pech", 11_500_000, "2026-07-10")], benchmarkMin }));
    expect(f).toBeTruthy();
    expect(f!.detail).toContain("44%"); // (11.5-8)/8 = 43.75 -> 44
  });
  it("normal narx -> null", () => {
    const benchmarkMin = new Map([["pech", 8_000_000]]);
    expect(priceAnomalyRule.evaluate(ctx({ purchases: [buy("Pech", 8_200_000, "2026-07-10")], benchmarkMin }))).toBeNull();
  });
});

describe("repeatPurchaseRule", () => {
  it("15 kun ichida 4+ marta -> takroriy xarid", () => {
    const purchases = Array.from({ length: 5 }, (_, i) => buy("Marker", 12000, `2026-07-0${i + 5}`));
    const f = repeatPurchaseRule.evaluate(ctx({ purchases }));
    expect(f?.ruleId).toBe("repeat");
    expect(f!.detail).toContain("5 marta");
  });
  it("eski xaridlar oynadan tashqarida -> null", () => {
    const purchases = Array.from({ length: 5 }, (_, i) => buy("Marker", 12000, `2026-05-0${i + 1}`));
    expect(repeatPurchaseRule.evaluate(ctx({ purchases }))).toBeNull();
  });
});

describe("missingDocsRule", () => {
  it("hisobot/foto yo'q yopilgan zayavka -> kritik", () => {
    const f = missingDocsRule.evaluate(ctx({ requests: [req(1, "closed", false, false), req(2, "closed", true, true)] }));
    expect(f?.level).toBe("critical");
    expect(f!.detail).toContain("1 ta");
  });
  it("rad etilgan hisobga olinmaydi; barchasi to'liq -> null", () => {
    expect(missingDocsRule.evaluate(ctx({ requests: [req(1, "rejected", false, false), req(2, "closed", true, true)] }))).toBeNull();
  });
});

describe("evaluateRisk — agregatsiya", () => {
  it("bir nechta xavf -> ball yig'iladi, daraja eng og'iri", () => {
    const benchmarkMin = new Map([["pech", 8_000_000]]);
    const r = evaluateRisk(ctx({
      limit: 100, spent: 96,
      purchases: [buy("Pech", 11_500_000, "2026-07-10")],
      requests: [req(1, "closed", false, true)],
      benchmarkMin,
    }));
    expect(r.level).toBe("critical"); // docs kritik
    expect(r.findings.length).toBeGreaterThanOrEqual(3);
    expect(r.score).toBeGreaterThan(0);
    expect(r.findings[0].level).toBe("critical"); // og'iri birinchi
    expect(r.recommendation.length).toBeGreaterThan(0);
  });
  it("xavfsiz -> good, ball 0", () => {
    const r = evaluateRisk(ctx({ limit: 100, spent: 10 }));
    expect(r.level).toBe("good");
    expect(r.score).toBe(0);
  });
  it("qoidalar registri kengaytiriladigan (RULES ro'yxati)", () => {
    expect(RULES.length).toBe(4);
    expect(worstLevel(["good", "risk", "attention"])).toBe("risk");
  });
});
