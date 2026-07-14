import { describe, it, expect } from "vitest";
import { evaluateAssetRisk, inventoryRule, expensiveRule, repairRule, transferRule, type AssetRiskContext } from "./assets";

const NOW = new Date("2026-07-13T10:00:00Z");
const ctx = (o: Partial<AssetRiskContext> = {}): AssetRiskContext => ({
  price: 1_000_000, hasPhoto: true, hasDocs: true, hasAssignee: true, lastInventoryAt: "2026-07-01",
  warrantyUntil: null, transferCount: 0, repairTotal: 0, expensiveThreshold: 10_000_000, now: NOW, ...o,
});

describe("asset qoidalari", () => {
  it("inventarizatsiya: null -> risk, eskirgan -> topilma", () => {
    expect(inventoryRule(ctx({ lastInventoryAt: null }))).toMatchObject({ level: "risk" });
    expect(inventoryRule(ctx({ lastInventoryAt: "2025-01-01" }))).toBeTruthy();
    expect(inventoryRule(ctx({ lastInventoryAt: "2026-07-01" }))).toBeNull();
  });
  it("qimmat aktiv nazoratsiz -> kritik", () => {
    expect(expensiveRule(ctx({ price: 20_000_000, hasAssignee: false }))).toMatchObject({ level: "critical" });
    expect(expensiveRule(ctx({ price: 20_000_000, hasAssignee: true, lastInventoryAt: "2026-07-01" }))).toBeNull();
  });
  it("ta'mir narxi aktivdan yuqori -> kritik", () => {
    expect(repairRule(ctx({ price: 1_000_000, repairTotal: 1_500_000 }))?.level).toBe("critical");
    expect(repairRule(ctx({ price: 1_000_000, repairTotal: 400_000 }))).toBeNull();
  });
  it("ko'p ko'chirilgan (3+) -> risk", () => {
    expect(transferRule(ctx({ transferCount: 4 }))?.ruleId).toBe("transfer");
    expect(transferRule(ctx({ transferCount: 2 }))).toBeNull();
  });
});

describe("evaluateAssetRisk — agregatsiya", () => {
  it("xavfsiz aktiv -> good", () => {
    expect(evaluateAssetRisk(ctx()).level).toBe("good");
  });
  it("bir nechta muammo -> kritik + tavsiya", () => {
    const r = evaluateAssetRisk(ctx({ price: 20_000_000, hasAssignee: false, hasPhoto: false, hasDocs: false, lastInventoryAt: null, transferCount: 5 }));
    expect(r.level).toBe("critical");
    expect(r.findings.length).toBeGreaterThanOrEqual(4);
    expect(r.recommendation.length).toBeGreaterThan(0);
  });
});
