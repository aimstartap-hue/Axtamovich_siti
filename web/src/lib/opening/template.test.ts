import { describe, it, expect } from "vitest";
import { OPENING_TEMPLATE, weightedProgress, resolveTemplate } from "./template";

describe("ochilish shabloni — vaznli progress", () => {
  it("default shablon vaznlari yig'indisi 100", () => {
    const total = OPENING_TEMPLATE.reduce((s, x) => s + x.weight, 0);
    expect(total).toBe(100);
  });

  it("bo'sh holatda progress 0", () => {
    expect(weightedProgress({})).toBe(0);
    expect(weightedProgress(null)).toBe(0);
  });

  it("faqat remont (22) bajarilsa progress 22%", () => {
    expect(weightedProgress({ repair: true })).toBe(22);
  });

  it("vazn SONga emas, og'irlikka qarab: remont(22) > 3 ta yengil bosqich(gaz+suv+kamera=10)", () => {
    expect(weightedProgress({ repair: true })).toBeGreaterThan(
      weightedProgress({ gas: true, water: true, camera: true }),
    );
  });

  it("hamma vaznli bosqich bajarilsa 100% (opened vazni 0)", () => {
    const done: Record<string, boolean> = {};
    for (const s of OPENING_TEMPLATE) done[s.key] = true;
    expect(weightedProgress(done)).toBe(100);
    // "opened" (vazn 0) bajarilmasa ham 100% bo'ladi
    const noOpened = { ...done }; delete noOpened.opened;
    expect(weightedProgress(noOpened)).toBe(100);
  });

  it("resolveTemplate override vaznni almashtiradi, defaultni buzmaydi", () => {
    const t = resolveTemplate({ repair: 50 });
    expect(t.find((s) => s.key === "repair")!.weight).toBe(50);
    expect(OPENING_TEMPLATE.find((s) => s.key === "repair")!.weight).toBe(22);
  });
});
