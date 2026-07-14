import { describe, it, expect } from "vitest";
import { priceFinding, repeatFinding, docsFindings } from "./purchase";

describe("priceFinding — per-item narx", () => {
  const bm = new Map([["pech", 8_000_000]]);
  it("30%+ qimmat -> topilma; foiz to'g'ri", () => {
    const f = priceFinding("Pech", 11_500_000, bm);
    expect(f?.ruleId).toBe("price");
    expect(f!.detail).toContain("44%");
  });
  it("100%+ -> kritik", () => {
    expect(priceFinding("Pech", 20_000_000, bm)?.level).toBe("critical");
  });
  it("normal narx yoki benchmark yo'q -> null", () => {
    expect(priceFinding("Pech", 8_500_000, bm)).toBeNull();
    expect(priceFinding("Yangi", 100, bm)).toBeNull();
  });
});

describe("repeatFinding", () => {
  it("4+ -> topilma, 3 -> null", () => {
    expect(repeatFinding("Marker", 5)?.ruleId).toBe("repeat");
    expect(repeatFinding("Marker", 3)).toBeNull();
  });
});

describe("docsFindings", () => {
  it("hisobot yo'q -> kritik", () => {
    const f = docsFindings(false, false);
    expect(f).toHaveLength(1);
    expect(f[0].level).toBe("critical");
  });
  it("hisobot bor, foto yo'q -> diqqat", () => {
    expect(docsFindings(true, false)[0].level).toBe("attention");
  });
  it("hammasi bor -> bo'sh", () => {
    expect(docsFindings(true, true)).toHaveLength(0);
  });
});
