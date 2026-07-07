import { describe, it, expect } from "vitest";
import { formatNumber, parseNumber, formatMoney } from "./format";

describe("formatNumber — mingliklar probel bilan", () => {
  it("1500000 → '1 500 000'", () => {
    expect(formatNumber(1_500_000)).toBe("1 500 000");
  });
  it("kichik son o'zgarmaydi", () => {
    expect(formatNumber(500)).toBe("500");
  });
  it("manfiy son", () => {
    expect(formatNumber(-1500)).toBe("-1 500");
  });
  it("bo'sh/null/undefined → bo'sh", () => {
    expect(formatNumber(null)).toBe("");
    expect(formatNumber(undefined)).toBe("");
    expect(formatNumber("")).toBe("");
  });
  it("string raqamni ham qabul qiladi", () => {
    expect(formatNumber("1500000")).toBe("1 500 000");
  });
});

describe("parseNumber — matndan raqam", () => {
  it("'1 500 000' → 1500000", () => {
    expect(parseNumber("1 500 000")).toBe(1_500_000);
  });
  it("bo'sh → 0", () => {
    expect(parseNumber("")).toBe(0);
    expect(parseNumber(null)).toBe(0);
  });
  it("harflarni tozalaydi", () => {
    expect(parseNumber("1 500 so'm")).toBe(1500);
  });
});

describe("formatMoney", () => {
  it("summa + so'm", () => {
    expect(formatMoney(1_500_000)).toBe("1 500 000 so'm");
  });
  it("valyuta ko'rsatish mumkin", () => {
    expect(formatMoney(100, "USD")).toBe("100 USD");
  });
  it("null → '—'", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(undefined)).toBe("—");
  });
});
