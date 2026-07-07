import { describe, it, expect } from "vitest";
import { toSom } from "./currency";

describe("toSom — valyutani so'mga aylantirish", () => {
  const rates = { USD: 12_800, EUR: 13_900 };

  it("so'm — o'zgarmaydi", () => {
    expect(toSom(100_000, "so'm", rates)).toBe(100_000);
    expect(toSom(100_000, "UZS", rates)).toBe(100_000);
    expect(toSom(100_000, null, rates)).toBe(100_000);
  });
  it("USD → kurs bo'yicha ko'paytiriladi", () => {
    expect(toSom(10, "USD", rates)).toBe(128_000);
  });
  it("EUR → o'z kursi", () => {
    expect(toSom(2, "EUR", rates)).toBe(27_800);
  });
  it("kurs yo'q bo'lsa — xavfsiz, o'zgarmaydi (noto'g'ri ko'paytirmaydi)", () => {
    expect(toSom(10, "GBP", rates)).toBe(10);
    expect(toSom(10, "USD", {})).toBe(10);
  });
});
