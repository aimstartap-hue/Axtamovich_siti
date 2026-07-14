import { describe, it, expect } from "vitest";
import { resolvePeriod, pctChange, dayKeysInRange, dayKey } from "./finance";

describe("resolvePeriod — davr chegaralari", () => {
  it("today — 1 kun, oldingi davr tutashadi", () => {
    const p = resolvePeriod("today");
    expect(p.days).toBe(1);
    expect(p.prevEnd).toBe(p.start); // oldingi davr joriy boshiga tutashadi
    expect(new Date(p.end).getTime() - new Date(p.start).getTime()).toBe(86_400_000);
  });
  it("30d — 30 kun, oldingi teng uzunlik", () => {
    const p = resolvePeriod("30d");
    expect(p.days).toBe(30);
    const len = new Date(p.end).getTime() - new Date(p.start).getTime();
    const prevLen = new Date(p.prevEnd).getTime() - new Date(p.prevStart).getTime();
    expect(prevLen).toBe(len);
    expect(p.prevEnd).toBe(p.start);
  });
  it("this_month — oldingi davr o'tgan oy", () => {
    const p = resolvePeriod("this_month");
    expect(p.prevEnd).toBe(p.start);
    expect(new Date(p.start).getUTCDate()).toBe(1); // oy boshi
  });
  it("custom — from/to (to inclusive, +1 kun)", () => {
    const p = resolvePeriod("custom", "2026-07-01", "2026-07-10");
    expect(p.start.slice(0, 10)).toBe("2026-07-01");
    expect(p.end.slice(0, 10)).toBe("2026-07-11"); // to + 1 kun (exclusive)
    expect(p.days).toBe(10);
  });
});

describe("pctChange", () => {
  it("oddiy o'sish/tushish", () => {
    expect(pctChange(120, 100)).toBe(20);
    expect(pctChange(80, 100)).toBe(-20);
  });
  it("oldingi 0 bo'lsa: joriy 0 -> 0, aks holda null (solishtirib bo'lmaydi)", () => {
    expect(pctChange(0, 0)).toBe(0);
    expect(pctChange(50, 0)).toBeNull();
  });
});

describe("dayKeysInRange / dayKey", () => {
  it("3 kunlik oraliq -> 3 kalit", () => {
    const keys = dayKeysInRange("2026-07-01T00:00:00.000Z", "2026-07-04T00:00:00.000Z");
    expect(keys).toEqual(["2026-07-01", "2026-07-02", "2026-07-03"]);
  });
  it("dayKey ISO dan kun ajratadi", () => {
    expect(dayKey("2026-07-05T10:30:00.000Z")).toBe("2026-07-05");
  });
});
