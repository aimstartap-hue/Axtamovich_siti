import { describe, it, expect } from "vitest";
import { isOpen, isClosed, isInProgress, isAging, isOverdue, currentMonth, monthRange, branchLabel, currentMonthBounds } from "./helpers";

const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); };
const daysAhead = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

describe("currentMonthBounds — default filter davri", () => {
  it("oy boshi va oxiri", () => {
    const b = currentMonthBounds(new Date("2026-07-15T00:00:00Z"));
    expect(b.from).toBe("2026-07-01");
    expect(b.to).toBe("2026-07-31");
  });
  it("fevral (28/29 kun)", () => {
    expect(currentMonthBounds(new Date("2026-02-10T00:00:00Z")).to).toBe("2026-02-28");
  });
});

describe("branchLabel — kompaniya prefiksini olib tashlaydi", () => {
  it("qavs ichidagi filial nomini oladi", () => {
    expect(branchLabel("Zahratun fast-food (Jondor-1)")).toBe("Jondor-1");
  });
  it("qavssiz nom o'zgarmaydi", () => {
    expect(branchLabel("G'ijduvon")).toBe("G'ijduvon");
  });
});

describe("status guruhlari", () => {
  it("isOpen", () => {
    expect(isOpen("pending_finance")).toBe(true);
    expect(isOpen("closed")).toBe(false);
    expect(isOpen("rejected")).toBe(false);
  });
  it("isClosed", () => {
    expect(isClosed("closed")).toBe(true);
    expect(isClosed("rejected")).toBe(true);
    expect(isClosed("pending_axo")).toBe(false);
  });
  it("isInProgress", () => {
    expect(isInProgress("approved")).toBe(true);
    expect(isInProgress("funded")).toBe(true);
    expect(isInProgress("pending_axo")).toBe(false);
  });
});

describe("isOverdue — muddati o'tgan", () => {
  it("ochiq + deadline o'tgan → true", () => {
    expect(isOverdue({ status: "approved", deadline: daysAhead(-2) })).toBe(true);
  });
  it("ochiq + deadline kelajakda → false", () => {
    expect(isOverdue({ status: "approved", deadline: daysAhead(5) })).toBe(false);
  });
  it("yopilgan → false (deadline o'tgan bo'lsa ham)", () => {
    expect(isOverdue({ status: "closed", deadline: daysAhead(-2) })).toBe(false);
  });
  it("deadline yo'q → false", () => {
    expect(isOverdue({ status: "approved", deadline: null })).toBe(false);
  });
});

describe("isAging — eskirgan (7 kundan ko'p ochiq yoki muddati o'tgan)", () => {
  it("7 kundan ko'p ochiq turган → true", () => {
    expect(isAging({ status: "pending_finance", deadline: null, created_at: daysAgo(10) })).toBe(true);
  });
  it("yaqinda yaratilgan → false", () => {
    expect(isAging({ status: "pending_finance", deadline: null, created_at: daysAgo(2) })).toBe(false);
  });
  it("yopilgan → false", () => {
    expect(isAging({ status: "closed", deadline: null, created_at: daysAgo(100) })).toBe(false);
  });
  it("muddati o'tgan (deadline past) → aging, 7 kundan kam bo'lsa ham", () => {
    expect(isAging({ status: "approved", deadline: daysAhead(-1), created_at: daysAgo(1) })).toBe(true);
  });
});

describe("currentMonth", () => {
  it("YYYY-MM formatida", () => {
    expect(currentMonth()).toMatch(/^\d{4}-\d{2}$/);
  });
  it("hozirgi oyga mos", () => {
    const d = new Date();
    expect(currentMonth()).toBe(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  });
});
