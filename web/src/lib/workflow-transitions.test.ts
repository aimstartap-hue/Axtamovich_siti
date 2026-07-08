import { describe, it, expect } from "vitest";
import { ALLOWED_TRANSITIONS, isValidTransition, isTerminal, type WorkflowStatus } from "./workflow-transitions";
import { nextStatusOnApprove } from "./workflow";
import { DEFAULT_CEO_THRESHOLD } from "./constants";

describe("isValidTransition — ruxsat etilgan o'tishlar", () => {
  it("to'g'ri o'tishlar", () => {
    expect(isValidTransition("pending_axo", "pending_finance")).toBe(true);
    expect(isValidTransition("pending_finance", "approved")).toBe(true);
    expect(isValidTransition("report_submitted", "closed")).toBe(true);
    expect(isValidTransition("rejected", "hr_review")).toBe(true);
  });
  it("noto'g'ri (sakrash) o'tishlar bloklanadi", () => {
    expect(isValidTransition("pending_axo", "closed")).toBe(false);      // AXO to'g'ridan yopa olmaydi
    expect(isValidTransition("pending_axo", "approved")).toBe(false);    // Moliyani chetlab o'tolmaydi
    expect(isValidTransition("closed", "pending_axo")).toBe(false);      // yopilgan qayta ochilmaydi
    expect(isValidTransition("approved", "closed")).toBe(false);         // ijrosiz yopilmaydi
  });
  it("CEO/admin override: jarayondagi holatdan ham rad etish mumkin", () => {
    // rejectAction guard bilan 1:1 (actions.ts): ceo/admin favqulodda rad etadi
    expect(isValidTransition("approved", "rejected")).toBe(true);
    expect(isValidTransition("funded", "rejected")).toBe(true);
    expect(isValidTransition("manager_doing", "rejected")).toBe(true);
    expect(isValidTransition("axo_review", "rejected")).toBe(true);
    expect(isValidTransition("deadline_dispute", "rejected")).toBe(true);
  });
  it("noma'lum holat — false", () => {
    expect(isValidTransition("xyz", "closed")).toBe(false);
  });
});

describe("isTerminal", () => {
  it("closed — terminal", () => {
    expect(isTerminal("closed")).toBe(true);
  });
  it("boshqalar terminal emas", () => {
    expect(isTerminal("pending_axo")).toBe(false);
    expect(isTerminal("rejected")).toBe(false); // rejected'dan qayta ochish/HR mumkin
  });
});

// Eng muhim: imperativ oqim (nextStatusOnApprove) DEKLARATIV grafga mos kelishi.
// Agar kimdir workflow.ts ni o'zgartirsa-yu grafni yangilamasa — bu test tutadi.
describe("nextStatusOnApprove grafga mos (drift himoyasi)", () => {
  const cases: { type: "maintenance" | "new_branch"; status: WorkflowStatus; amount: number | null }[] = [
    { type: "maintenance", status: "pending_axo", amount: 1_000_000 },
    { type: "maintenance", status: "pending_axo", amount: DEFAULT_CEO_THRESHOLD + 1 },
    { type: "new_branch", status: "pending_axo", amount: 1 },
    { type: "maintenance", status: "pending_ceo", amount: null },
    { type: "maintenance", status: "pending_finance", amount: null },
    { type: "new_branch", status: "pending_finance", amount: null },
    { type: "maintenance", status: "report_submitted", amount: null },
  ];
  it("har bir tasdiq natijasi ruxsat etilgan o'tish", () => {
    for (const c of cases) {
      const next = nextStatusOnApprove({ type: c.type, status: c.status }, c.amount);
      expect(isValidTransition(c.status, next), `${c.status} → ${next}`).toBe(true);
    }
  });
});

describe("graf yaxlitligi", () => {
  it("har bir maqsad-holat ham grafda mavjud (osilgan o'tish yo'q)", () => {
    const keys = Object.keys(ALLOWED_TRANSITIONS) as WorkflowStatus[];
    for (const from of keys) {
      for (const to of ALLOWED_TRANSITIONS[from]) {
        expect(keys, `${to} grafda yo'q`).toContain(to);
      }
    }
  });
});
