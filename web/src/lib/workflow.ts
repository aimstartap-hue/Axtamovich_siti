// =============================================================================
// Workflow logikasi — TOZA qatlam (Supabase/serverdan mustaqil).
// server.py dagi qoidalarni aynan takrorlaydi.
//
// Oqim:
//  Texnik (maintenance):   AXO -> [katta summa bo'lsa CEO] -> Moliya -> approved -> hisobot -> closed
//  Yangi filial (new_branch): AXO -> CEO -> Moliya -> funded -> hisobot -> closed
// =============================================================================

import { DEFAULT_CEO_THRESHOLD, type Role } from "./constants";
import type { RequestRow, Profile } from "./types";

type Req = Pick<
  RequestRow,
  "type" | "status" | "created_by" | "branch_id" | "rejected_by" | "deadline_disputed"
>;

export function startStatus(): string {
  return "pending_axo";
}

/** Berilgan rol shu statusdagi zayavkani tasdiqlay oladimi? */
export function canApprove(req: Pick<Req, "status">, role: Role): boolean {
  const s = req.status;
  if (s === "pending_axo") return role === "axo";
  if (s === "pending_ceo") return role === "ceo";
  if (s === "pending_finance") return role === "finance";
  if (s === "report_submitted") return role === "ceo" || role === "finance";
  return false;
}

/** Shu tasdiqda muddat (sana) belgilanadimi? — CEO bosqichida. */
export function setsDeadlineOnApprove(req: Pick<Req, "status">): boolean {
  return req.status === "pending_ceo";
}

/** Shu tasdiqda Moliya AXO uchun limit qo'yadimi? */
export function setsLimitOnApprove(req: Pick<Req, "type" | "status">): boolean {
  return req.type === "maintenance" && req.status === "pending_finance";
}

/** Shu tasdiqda AXO summa (narx) kiritadimi? — AXO bosqichida. */
export function setsEstimateOnApprove(req: Pick<Req, "status">): boolean {
  return req.status === "pending_axo";
}

export function canRequestDeadlineChange(req: Pick<Req, "status" | "deadline_disputed">, role: Role): boolean {
  return req.status === "pending_finance" && role === "finance" && !req.deadline_disputed;
}

export function canResolveDispute(req: Pick<Req, "status">, role: Role): boolean {
  return req.status === "deadline_dispute" && role === "ceo";
}

/** Keyingi status. */
export function nextStatusOnApprove(
  req: Pick<Req, "type" | "status">,
  amount: number | null = null,
  threshold: number = DEFAULT_CEO_THRESHOLD,
): string {
  const { type: t, status: s } = req;
  if (s === "pending_axo") {
    if (t === "new_branch") return "pending_ceo";
    if (amount !== null && amount > threshold) return "pending_ceo";
    return "pending_finance";
  }
  if (s === "pending_ceo") return "pending_finance";
  if (s === "pending_finance") return t === "new_branch" ? "funded" : "approved";
  if (s === "report_submitted") return "closed";
  return s;
}

export function canSubmitReport(req: Pick<Req, "type" | "status">, role: Role): boolean {
  const { type: t, status: s } = req;
  if (t === "maintenance" && s === "approved" && role === "axo") return true;
  if (t === "new_branch" && s === "funded" && role === "open_group") return true;
  // Delegatsiya: menejer o'zi bajarib hisobot beradi
  if (t === "maintenance" && s === "manager_doing" && role === "branch_manager") return true;
  return false;
}

/** AXO zayavkani menejerga topshira oladimi? (o'zi qilish o'rniga) */
export function canDelegateToManager(req: Pick<Req, "type" | "status">, role: Role): boolean {
  return req.type === "maintenance" && req.status === "pending_axo" && role === "axo";
}

/** AXO menejer topshirgan hisobotni tekshirib Moliyaga uzatadimi? */
export function canAxoReview(req: Pick<Req, "status">, role: Role): boolean {
  return req.status === "axo_review" && role === "axo";
}

export function canReopen(req: Pick<Req, "status" | "rejected_by">, user: Pick<Profile, "id" | "role">): boolean {
  if (req.status !== "rejected") return false;
  return user.role === "ceo" || user.role === "admin" || req.rejected_by === user.id;
}

export function canSendToHr(req: Pick<Req, "status" | "rejected_by">, user: Pick<Profile, "id" | "role">): boolean {
  if (req.status !== "rejected") return false;
  return user.role === "ceo" || user.role === "admin" || req.rejected_by === user.id;
}

export function canHrResolve(req: Pick<Req, "status">, role: Role): boolean {
  return req.status === "hr_review" && (role === "hr" || role === "admin");
}

/** Shu rol uchun bu zayavka hozir harakat (tasdiq/hisobot) talab qiladimi? */
export function needsAction(req: Req, role: Role): boolean {
  if (canApprove(req, role) || canSubmitReport(req, role)) return true;
  if (canResolveDispute(req, role)) return true;
  if (canAxoReview(req, role)) return true;
  if (role === "hr" && req.status === "hr_review") return true;
  return false;
}

// Status -> shu bosqichda harakat qilishi kerak bo'lgan rollar (bildirishnoma uchun)
export const NOTIFY_ROLES: Record<string, Role[]> = {
  pending_axo: ["axo"],
  pending_ceo: ["ceo"],
  pending_finance: ["finance"],
  approved: ["axo"],
  manager_doing: ["branch_manager"],
  axo_review: ["axo"],
  report_submitted: ["ceo", "finance"],
  deadline_dispute: ["ceo"],
  funded: ["open_group"],
  hr_review: ["hr"],
};

/**
 * Foydalanuvchi shu zayavkani ko'ra oladimi?
 * (branch_manager/regmen uchun filiallar ro'yxati kerak.)
 */
export function canView(
  req: Pick<Req, "type" | "status" | "created_by" | "branch_id">,
  user: Pick<Profile, "id" | "role" | "branch_id">,
  opts: { userBranchIds?: number[]; regmenBranchIds?: number[] } = {},
): boolean {
  const role = user.role;
  if (role === "branch_manager") {
    if (req.created_by === user.id) return true;
    const allowed = opts.userBranchIds ?? [];
    if (allowed.length) return req.branch_id !== null && allowed.includes(req.branch_id);
    return req.branch_id === user.branch_id;
  }
  if (role === "regmen") {
    if (req.type !== "maintenance") return false;
    if (req.created_by === user.id) return true;
    const allowed = opts.regmenBranchIds ?? [];
    return req.branch_id !== null && allowed.includes(req.branch_id);
  }
  if (role === "axo") return req.type === "maintenance";
  if (role === "open_group") return req.type === "new_branch";
  if (role === "hr") return req.status === "hr_review";
  if (role === "oper") return false;
  // admin, ceo, finance, ops_director — hammasi
  return true;
}

/** O'zbekcha sana formati: 05.07.2026 */
export function formatDate(d: string | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(dt.getDate())}.${p(dt.getMonth() + 1)}.${dt.getFullYear()}`;
}

// Pul/raqam formatlari markazlashtirilgan util'da (mingliklar probel bilan)
export { formatMoney, formatNumber, parseNumber } from "./format";
