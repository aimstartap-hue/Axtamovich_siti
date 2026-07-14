import { describe, it, expect } from "vitest";
import { statusView, priorityView, slaView, currentOwner, relativeTime } from "./requests-view";

const NOW = new Date("2026-07-12T10:00:00Z");

describe("statusView — rangli guruh", () => {
  it("yopilgan yashil, rad kulrang, moliya kutmoqda sariq", () => {
    expect(statusView("closed").tone).toBe("green");
    expect(statusView("rejected").tone).toBe("gray");
    expect(statusView("pending_finance").tone).toBe("amber");
    expect(statusView("report_submitted").tone).toBe("orange");
    expect(statusView("manager_doing").tone).toBe("blue");
  });
});

describe("priorityView", () => {
  it("urgent qizil, low kulrang, null->null", () => {
    expect(priorityView("urgent")?.tone).toBe("red");
    expect(priorityView("low")?.tone).toBe("gray");
    expect(priorityView(null)).toBeNull();
  });
});

describe("slaView — deadline holati", () => {
  it("kechikkan qizil", () => {
    expect(slaView("2026-07-08", "pending_finance", NOW)).toMatchObject({ tone: "red" });
  });
  it("bugun orange", () => {
    expect(slaView("2026-07-12", "approved", NOW)).toMatchObject({ tone: "orange" });
  });
  it("uzoq yashil, yaqin sariq", () => {
    expect(slaView("2026-07-20", "approved", NOW)?.tone).toBe("green");
    expect(slaView("2026-07-13", "approved", NOW)?.tone).toBe("amber");
  });
  it("yopilgan yoki deadline yo'q -> null", () => {
    expect(slaView("2026-07-01", "closed", NOW)).toBeNull();
    expect(slaView(null, "approved", NOW)).toBeNull();
  });
});

describe("currentOwner", () => {
  it("status -> mas'ul rol", () => {
    expect(currentOwner("pending_ceo")).toBe("CEO");
    expect(currentOwner("pending_finance")).toBe("Moliya");
    expect(currentOwner("closed")).toBeNull();
  });
});

describe("relativeTime", () => {
  it("bugun/kecha/kun/hafta", () => {
    expect(relativeTime(new Date().toISOString())).toBe("bugun");
    const now = new Date();
    const d2 = new Date(now); d2.setDate(now.getDate() - 2);
    expect(relativeTime(d2.toISOString(), now)).toBe("2 kun oldin");
    const d10 = new Date(now); d10.setDate(now.getDate() - 10);
    expect(relativeTime(d10.toISOString(), now)).toBe("1 hafta oldin");
  });
});
