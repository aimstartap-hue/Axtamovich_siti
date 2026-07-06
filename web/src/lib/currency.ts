// =============================================================================
// Valyuta — CBU (Markaziy bank) kurslari va so'mga aylantirish (punkt 4).
// =============================================================================

export type Rates = Record<string, number>;

/** Bizni qiziqtiradigan asosiy valyutalar. */
export const TRACKED_CURRENCIES = ["USD", "EUR", "RUB"];

/** CBU'dan joriy kurslarni oladi: { USD: 12800, EUR: 13900, ... } (1 birlik = X so'm). */
export async function fetchCbuRates(): Promise<Rates> {
  const res = await fetch("https://cbu.uz/uz/arkhiv-kursov-valyut/json/", { cache: "no-store" });
  if (!res.ok) throw new Error("CBU javob bermadi");
  const data = (await res.json()) as { Ccy: string; Rate: string }[];
  const map: Rates = {};
  for (const r of data) {
    const v = parseFloat(r.Rate);
    if (r.Ccy && !isNaN(v)) map[r.Ccy] = v;
  }
  return map;
}

/** Berilgan summani so'mga aylantiradi (valyuta so'm bo'lsa — o'zgarishsiz). */
export function toSom(amount: number, currency: string | null | undefined, rates: Rates): number {
  if (!currency || currency === "so'm" || currency === "UZS") return amount;
  const rate = rates[currency];
  return rate ? amount * rate : amount;
}
