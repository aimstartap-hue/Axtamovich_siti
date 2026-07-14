import { describe, it, expect } from "vitest";
import { buildAnomalies, type AItem } from "./anomalies";

const item = (name: string, price: number, date: string, branch: number | null = 1, supplier: string | null = null, category = "Test", qty = 1, who: string | null = null): AItem =>
  ({ name, category, supplier, qty, price, who, report: { created_at: date, request: { branch_id: branch } } });

describe("buildAnomalies — real ma'lumotdan anomaliya", () => {
  it("narx sakrashi (oxirgi ikki xarid) topiladi", () => {
    const items = [item("Marker", 12000, "2026-07-01"), item("Marker", 1_000_000, "2026-07-10")];
    const a = buildAnomalies(items, new Map(), new Map(), new Map(), new Map(), new Map(), 0, 0);
    const spike = a.find((x) => x.title.includes("narx oshdi"));
    expect(spike).toBeTruthy();
    expect(spike!.sev).toBe("critical"); // 3x dan oshgan
  });

  it("narx anomaliyasiga to'liq xarid tarixi (kim oldi) biriktiriladi", () => {
    const items = [
      item("Marker", 12000, "2026-02-01", 1, "Korzinka", "Kanselyariya", 1, "Aliyev Vali"),
      item("Marker", 1_000_000, "2026-07-10", 1, "Metro", "Kanselyariya", 1, "Soliyev Sarvar"),
    ];
    const a = buildAnomalies(items, new Map([[1, "Jondor-1"]]), new Map(), new Map(), new Map(), new Map(), 0, 0);
    const spike = a.find((x) => x.title.includes("narx oshdi"))!;
    expect(spike.history).toHaveLength(2);
    expect(spike.history![0]).toMatchObject({ price: 12000, who: "Aliyev Vali", branch: "Jondor-1" });
    expect(spike.history![1].who).toBe("Soliyev Sarvar");
  });

  it("bir marta xarid qilingan mahsulot anomaliya bermaydi", () => {
    const a = buildAnomalies([item("Ruchka", 3000, "2026-07-01")], new Map(), new Map(), new Map(), new Map(), new Map(), 0, 0);
    expect(a.length).toBe(0);
  });

  it("filiallararo keskin farq aniqlanadi", () => {
    const items = [item("Konditsioner", 8_000_000, "2026-07-05", 1), item("Konditsioner", 13_000_000, "2026-07-06", 2)];
    const a = buildAnomalies(items, new Map([[1, "Buxoro"], [2, "Gijduvon"]]), new Map(), new Map(), new Map(), new Map(), 0, 0);
    expect(a.some((x) => x.title.includes("filiallarda keskin farq"))).toBe(true);
  });

  it("byudjetdan oshgan filial — kritik", () => {
    const a = buildAnomalies([], new Map([[1, "Chilonzor"]]), new Map([[1, 3_000_000]]), new Map([[1, 5_000_000]]), new Map(), new Map(), 0, 0);
    const over = a.find((x) => x.title.includes("byudjetdan oshdi"));
    expect(over).toBeTruthy();
    expect(over!.sev).toBe("critical");
    expect(over!.href).toBe("/budgets");
  });

  it("kategoriya keskin oshishi (+40%)", () => {
    const a = buildAnomalies([], new Map(), new Map(), new Map(), new Map([["Ta'mirlash", 10_000_000]]), new Map([["Ta'mirlash", 5_000_000]]), 0, 0);
    expect(a.some((x) => x.title.includes("Ta'mirlash"))).toBe(true);
  });

  it("severity bo'yicha saralanadi (kritik birinchi)", () => {
    const items = [item("Marker", 12000, "2026-07-01"), item("Marker", 1_000_000, "2026-07-10")];
    const a = buildAnomalies(items, new Map([[1, "F"]]), new Map([[1, 1_000_000]]), new Map([[1, 9_000_000]]), new Map(), new Map(), 0, 0);
    const rank = { critical: 0, serious: 1, warning: 2 };
    for (let i = 1; i < a.length; i++) expect(rank[a[i].sev]).toBeGreaterThanOrEqual(rank[a[i - 1].sev]);
  });
});
