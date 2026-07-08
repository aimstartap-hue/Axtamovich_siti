import { describe, it, expect } from "vitest";
import { isOpen, isClosed, isInProgress, isAging, isOverdue, currentMonth } from "./helpers";

const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); };
const daysAhead = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

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
