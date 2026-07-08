import { describe, it, expect } from "vitest";
import {
  startStatus, canApprove, nextStatusOnApprove, setsLimitOnApprove,
  setsDeadlineOnApprove, setsEstimateOnApprove, canSubmitReport,
  canDelegateToManager, canAxoReview, canView, canReopen, canSendToHr,
  canHrResolve, needsAction, formatDate,
  canRequestDeadlineChange, canResolveDispute, NOTIFY_ROLES,
} from "./workflow";
import { DEFAULT_CEO_THRESHOLD } from "./constants";

// Nazorat mantiqi — bu funksiyalar pulning oqimini boshqaradi, shuning uchun
// har bir bosqich aniq test qilinadi (Blueprint: SoD + Workflow izchilligi).

describe("startStatus", () => {
  it("har doim pending_axo dan boshlanadi", () => {
    expect(startStatus()).toBe("pending_axo");
  });
});

describe("canApprove — kim qaysi bosqichni tasdiqlaydi", () => {
  it("pending_axo — faqat axo", () => {
    expect(canApprove({ status: "pending_axo" }, "axo")).toBe(true);
    expect(canApprove({ status: "pending_axo" }, "ceo")).toBe(false);
    expect(canApprove({ status: "pending_axo" }, "finance")).toBe(false);
  });
  it("pending_ceo — faqat ceo", () => {
    expect(canApprove({ status: "pending_ceo" }, "ceo")).toBe(true);
    expect(canApprove({ status: "pending_ceo" }, "axo")).toBe(false);
  });
  it("pending_finance — faqat finance", () => {
    expect(canApprove({ status: "pending_finance" }, "finance")).toBe(true);
    expect(canApprove({ status: "pending_finance" }, "ceo")).toBe(false);
  });
  it("report_submitted — ceo yoki finance", () => {
    expect(canApprove({ status: "report_submitted" }, "ceo")).toBe(true);
    expect(canApprove({ status: "report_submitted" }, "finance")).toBe(true);
    expect(canApprove({ status: "report_submitted" }, "axo")).toBe(false);
  });
  it("noma'lum status — hech kim", () => {
    expect(canApprove({ status: "closed" }, "ceo")).toBe(false);
  });
});

describe("nextStatusOnApprove — pul oqimi yo'nalishi", () => {
  it("maintenance kichik summa (chegaradan past) → to'g'ridan Moliyaga", () => {
    expect(nextStatusOnApprove({ type: "maintenance", status: "pending_axo" }, 1_000_000)).toBe("pending_finance");
  });
  it("maintenance yirik summa (chegaradan yuqori) → avval CEO", () => {
    expect(nextStatusOnApprove({ type: "maintenance", status: "pending_axo" }, DEFAULT_CEO_THRESHOLD + 1)).toBe("pending_ceo");
  });
  it("chegaraga TENG summa CEO ga bormaydi (faqat qat'iy katta)", () => {
    expect(nextStatusOnApprove({ type: "maintenance", status: "pending_axo" }, DEFAULT_CEO_THRESHOLD)).toBe("pending_finance");
  });
  it("new_branch har doim avval CEO ga (summadan qat'i nazar)", () => {
    expect(nextStatusOnApprove({ type: "new_branch", status: "pending_axo" }, 1)).toBe("pending_ceo");
  });
  it("summa null bo'lsa (kiritilmagan) — Moliyaga", () => {
    expect(nextStatusOnApprove({ type: "maintenance", status: "pending_axo" }, null)).toBe("pending_finance");
  });
  it("pending_ceo → pending_finance", () => {
    expect(nextStatusOnApprove({ type: "maintenance", status: "pending_ceo" })).toBe("pending_finance");
  });
  it("pending_finance: maintenance → approved, new_branch → funded", () => {
    expect(nextStatusOnApprove({ type: "maintenance", status: "pending_finance" })).toBe("approved");
    expect(nextStatusOnApprove({ type: "new_branch", status: "pending_finance" })).toBe("funded");
  });
  it("report_submitted → closed", () => {
    expect(nextStatusOnApprove({ type: "maintenance", status: "report_submitted" })).toBe("closed");
  });
  it("maxsus threshold parametri ishlaydi", () => {
    expect(nextStatusOnApprove({ type: "maintenance", status: "pending_axo" }, 6_000_000, 5_000_000)).toBe("pending_ceo");
  });
});

describe("tasdiqda qanday maydonlar to'ldiriladi", () => {
  it("estimate — faqat AXO bosqichida", () => {
    expect(setsEstimateOnApprove({ status: "pending_axo" })).toBe(true);
    expect(setsEstimateOnApprove({ status: "pending_ceo" })).toBe(false);
  });
  it("deadline — faqat CEO bosqichida", () => {
    expect(setsDeadlineOnApprove({ status: "pending_ceo" })).toBe(true);
    expect(setsDeadlineOnApprove({ status: "pending_axo" })).toBe(false);
  });
  it("limit — faqat maintenance + Moliya bosqichida", () => {
    expect(setsLimitOnApprove({ type: "maintenance", status: "pending_finance" })).toBe(true);
    expect(setsLimitOnApprove({ type: "new_branch", status: "pending_finance" })).toBe(false);
    expect(setsLimitOnApprove({ type: "maintenance", status: "pending_axo" })).toBe(false);
  });
});

describe("canSubmitReport — hisobotni kim topshiradi", () => {
  it("maintenance approved — axo", () => {
    expect(canSubmitReport({ type: "maintenance", status: "approved" }, "axo")).toBe(true);
    expect(canSubmitReport({ type: "maintenance", status: "approved" }, "finance")).toBe(false);
  });
  it("new_branch funded — open_group", () => {
    expect(canSubmitReport({ type: "new_branch", status: "funded" }, "open_group")).toBe(true);
    expect(canSubmitReport({ type: "new_branch", status: "funded" }, "axo")).toBe(false);
  });
  it("delegatsiya: manager_doing — branch_manager", () => {
    expect(canSubmitReport({ type: "maintenance", status: "manager_doing" }, "branch_manager")).toBe(true);
  });
  it("noto'g'ri holat — yo'q", () => {
    expect(canSubmitReport({ type: "maintenance", status: "pending_axo" }, "axo")).toBe(false);
  });
});

describe("delegatsiya va axo_review", () => {
  it("AXO menejerga topshira oladi (maintenance + pending_axo)", () => {
    expect(canDelegateToManager({ type: "maintenance", status: "pending_axo" }, "axo")).toBe(true);
    expect(canDelegateToManager({ type: "new_branch", status: "pending_axo" }, "axo")).toBe(false);
  });
  it("axo_review — faqat axo", () => {
    expect(canAxoReview({ status: "axo_review" }, "axo")).toBe(true);
    expect(canAxoReview({ status: "axo_review" }, "ceo")).toBe(false);
  });
});

describe("canView — data isolation (kim nimani ko'radi)", () => {
  const base = { type: "maintenance" as const, status: "pending_finance", created_by: "u1", branch_id: 5 };
  it("axo — faqat maintenance", () => {
    expect(canView(base, { id: "x", role: "axo", branch_id: null })).toBe(true);
    expect(canView({ ...base, type: "new_branch" }, { id: "x", role: "axo", branch_id: null })).toBe(false);
  });
  it("open_group — faqat new_branch", () => {
    expect(canView({ ...base, type: "new_branch" }, { id: "x", role: "open_group", branch_id: null })).toBe(true);
    expect(canView(base, { id: "x", role: "open_group", branch_id: null })).toBe(false);
  });
  it("branch_manager — o'z filiali yoki o'zi yaratgani", () => {
    expect(canView(base, { id: "u2", role: "branch_manager", branch_id: 5 })).toBe(true);
    expect(canView(base, { id: "u2", role: "branch_manager", branch_id: 9 })).toBe(false);
    expect(canView(base, { id: "u1", role: "branch_manager", branch_id: 9 })).toBe(true); // o'zi yaratgan
  });
  it("branch_manager — ruxsat berilgan filiallar ro'yxati bilan", () => {
    expect(canView(base, { id: "u2", role: "branch_manager", branch_id: 1 }, { userBranchIds: [5, 7] })).toBe(true);
    expect(canView(base, { id: "u2", role: "branch_manager", branch_id: 1 }, { userBranchIds: [7, 8] })).toBe(false);
  });
  it("oper — hech narsa", () => {
    expect(canView(base, { id: "x", role: "oper", branch_id: null })).toBe(false);
  });
  it("admin/ceo/finance — hammasi", () => {
    for (const role of ["admin", "ceo", "finance", "ops_director"] as const) {
      expect(canView({ ...base, type: "new_branch" }, { id: "x", role, branch_id: null })).toBe(true);
    }
  });
});

describe("rad etilgandan keyin", () => {
  it("canReopen — ceo/admin yoki rad etgan shaxs", () => {
    expect(canReopen({ status: "rejected", rejected_by: "u9" }, { id: "u1", role: "ceo" })).toBe(true);
    expect(canReopen({ status: "rejected", rejected_by: "u9" }, { id: "u9", role: "axo" })).toBe(true);
    expect(canReopen({ status: "rejected", rejected_by: "u9" }, { id: "u1", role: "axo" })).toBe(false);
  });
  it("faqat rejected holatda", () => {
    expect(canReopen({ status: "closed", rejected_by: "u1" }, { id: "u1", role: "ceo" })).toBe(false);
  });
  it("canSendToHr — o'xshash qoida", () => {
    expect(canSendToHr({ status: "rejected", rejected_by: "u9" }, { id: "u1", role: "admin" })).toBe(true);
    expect(canSendToHr({ status: "pending_axo", rejected_by: null }, { id: "u1", role: "admin" })).toBe(false);
  });
  it("canHrResolve — hr_review + hr/admin", () => {
    expect(canHrResolve({ status: "hr_review" }, "hr")).toBe(true);
    expect(canHrResolve({ status: "hr_review" }, "admin")).toBe(true);
    expect(canHrResolve({ status: "hr_review" }, "ceo")).toBe(false);
  });
});

describe("needsAction — rol uchun harakat kerakmi", () => {
  it("pending_finance da finance uchun kerak", () => {
    expect(needsAction({ type: "maintenance", status: "pending_finance", created_by: "u", branch_id: 1, rejected_by: null, deadline_disputed: false }, "finance")).toBe(true);
  });
  it("boshqa rol uchun kerak emas", () => {
    expect(needsAction({ type: "maintenance", status: "pending_finance", created_by: "u", branch_id: 1, rejected_by: null, deadline_disputed: false }, "axo")).toBe(false);
  });
});

describe("formatDate — o'zbekcha sana", () => {
  it("ISO sanani 05.07.2026 formatiga o'giradi", () => {
    expect(formatDate("2026-07-05T10:00:00Z")).toBe("05.07.2026");
  });
  it("bo'sh qiymat — bo'sh string", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
  });
});

describe("muddat nizosi (deadline dispute)", () => {
  it("Moliya muddat o'zgarishini so'ray oladi (pending_finance, hali so'ralmagan)", () => {
    expect(canRequestDeadlineChange({ status: "pending_finance", deadline_disputed: false }, "finance")).toBe(true);
  });
  it("allaqachon so'ralган bo'lsa — qayta so'rolmaydi", () => {
    expect(canRequestDeadlineChange({ status: "pending_finance", deadline_disputed: true }, "finance")).toBe(false);
  });
  it("faqat finance", () => {
    expect(canRequestDeadlineChange({ status: "pending_finance", deadline_disputed: false }, "ceo")).toBe(false);
  });
  it("nizoni faqat CEO hal qiladi", () => {
    expect(canResolveDispute({ status: "deadline_dispute" }, "ceo")).toBe(true);
    expect(canResolveDispute({ status: "deadline_dispute" }, "finance")).toBe(false);
    expect(canResolveDispute({ status: "pending_finance" }, "ceo")).toBe(false);
  });
});

describe("canView — regmen (regional menejer)", () => {
  const req = { type: "maintenance" as const, status: "pending_finance", created_by: "u1", branch_id: 5 };
  it("faqat maintenance turini ko'radi", () => {
    expect(canView({ ...req, type: "new_branch" }, { id: "x", role: "regmen", branch_id: null })).toBe(false);
  });
  it("o'ziga biriktirilgan filiallar zayavkasini ko'radi", () => {
    expect(canView(req, { id: "x", role: "regmen", branch_id: null }, { regmenBranchIds: [5, 6] })).toBe(true);
    expect(canView(req, { id: "x", role: "regmen", branch_id: null }, { regmenBranchIds: [7] })).toBe(false);
  });
  it("o'zi yaratgan zayavkani doim ko'radi", () => {
    expect(canView(req, { id: "u1", role: "regmen", branch_id: null }, { regmenBranchIds: [] })).toBe(true);
  });
});

describe("needsAction — barcha yo'nalishlar", () => {
  const mk = (status: string) => ({ type: "maintenance" as const, status, created_by: "u", branch_id: 1, rejected_by: null, deadline_disputed: false });
  it("CEO uchun nizoда harakat kerak", () => {
    expect(needsAction(mk("deadline_dispute"), "ceo")).toBe(true);
  });
  it("AXO uchun axo_review da harakat kerak", () => {
    expect(needsAction(mk("axo_review"), "axo")).toBe(true);
  });
  it("HR uchun hr_review da harakat kerak", () => {
    expect(needsAction(mk("hr_review"), "hr")).toBe(true);
  });
  it("hisobot topshirish ham harakat (approved + axo)", () => {
    expect(needsAction(mk("approved"), "axo")).toBe(true);
  });
});

describe("NOTIFY_ROLES — bildirishnoma yo'nalishi (kimga xabar boradi)", () => {
  it("har bosqichda to'g'ri rol(lar)", () => {
    expect(NOTIFY_ROLES.pending_axo).toEqual(["axo"]);
    expect(NOTIFY_ROLES.pending_ceo).toEqual(["ceo"]);
    expect(NOTIFY_ROLES.pending_finance).toEqual(["finance"]);
    expect(NOTIFY_ROLES.report_submitted).toEqual(["ceo", "finance"]);
    expect(NOTIFY_ROLES.funded).toEqual(["open_group"]);
    expect(NOTIFY_ROLES.deadline_dispute).toEqual(["ceo"]);
    expect(NOTIFY_ROLES.hr_review).toEqual(["hr"]);
  });
});
