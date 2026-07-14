// =============================================================================
// Moliya dashboard — davr (period) mantiqi. Barcha filtrlar va "oldingi davr
// bilan solishtirish" shu yerdan. Chegaralar UTC (created_at UTC bilan mos).
// =============================================================================

export type PeriodPreset =
  | "today" | "yesterday" | "7d" | "30d" | "this_month" | "last_month" | "custom";

export interface Period {
  start: string;      // ISO (inclusive)
  end: string;        // ISO (exclusive)
  prevStart: string;  // oldingi teng uzunlikdagi davr
  prevEnd: string;
  days: number;
  label: string;
}

export const PERIOD_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: "today", label: "Bugun" },
  { value: "yesterday", label: "Kecha" },
  { value: "7d", label: "7 kun" },
  { value: "30d", label: "30 kun" },
  { value: "this_month", label: "Bu oy" },
  { value: "last_month", label: "O'tgan oy" },
];

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString();
const dayStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Preset (yoki custom from/to) -> aniq davr + oldingi teng davr. */
export function resolvePeriod(preset: PeriodPreset, from?: string, to?: string): Period {
  const now = new Date();
  const todayStart = dayStart(now);
  let start: Date;
  let end: Date;
  let label = "";

  switch (preset) {
    case "today":
      start = todayStart; end = new Date(todayStart.getTime() + DAY); label = "Bugun"; break;
    case "yesterday":
      end = todayStart; start = new Date(todayStart.getTime() - DAY); label = "Kecha"; break;
    case "7d":
      end = new Date(todayStart.getTime() + DAY); start = new Date(end.getTime() - 7 * DAY); label = "7 kun"; break;
    case "30d":
      end = new Date(todayStart.getTime() + DAY); start = new Date(end.getTime() - 30 * DAY); label = "30 kun"; break;
    case "this_month":
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)); label = "Bu oy"; break;
    case "last_month":
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); label = "O'tgan oy"; break;
    case "custom": {
      start = from ? dayStart(new Date(from)) : new Date(todayStart.getTime() - 7 * DAY);
      end = to ? new Date(dayStart(new Date(to)).getTime() + DAY) : new Date(todayStart.getTime() + DAY);
      label = "Tanlangan"; break;
    }
  }

  const len = Math.max(DAY, end.getTime() - start.getTime());
  const prevEnd = start;
  const prevStart = new Date(start.getTime() - len);
  return {
    start: iso(start), end: iso(end),
    prevStart: iso(prevStart), prevEnd: iso(prevEnd),
    days: Math.round(len / DAY), label,
  };
}

/** Foiz o'zgarish (oldingi davrga nisbatan). null = solishtirib bo'lmaydi. */
export function pctChange(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/** ISO sanani 'YYYY-MM-DD' kalitiga (UTC kun). */
export function dayKey(isoTs: string): string {
  return isoTs.slice(0, 10);
}

/** Davr ichidagi har kun uchun kalitlar ro'yxati (grafik o'qi uchun). */
export function dayKeysInRange(startIso: string, endIso: string, cap = 120): string[] {
  const out: string[] = [];
  let t = dayStart(new Date(startIso)).getTime();
  const endT = new Date(endIso).getTime();
  while (t < endT && out.length < cap) {
    out.push(new Date(t).toISOString().slice(0, 10));
    t += DAY;
  }
  return out;
}
