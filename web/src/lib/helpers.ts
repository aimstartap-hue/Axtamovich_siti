import type { RequestRow } from "./types";

export const OPEN_STATUSES = [
  "pending_axo", "pending_ceo", "pending_finance", "deadline_dispute",
  "approved", "manager_doing", "axo_review", "report_submitted", "funded", "hr_review",
];

export function isOpen(status: string): boolean {
  return OPEN_STATUSES.includes(status);
}

export function isClosed(status: string): boolean {
  return status === "closed" || status === "rejected";
}

/** Ish jarayonida (tasdiqlangan, bajarilyapti) */
export function isInProgress(status: string): boolean {
  return ["approved", "manager_doing", "axo_review", "report_submitted", "funded"].includes(status);
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

/** Kechikkan/eskirgan: muddati o'tgan yoki ochiq holda 7 kundan ko'p turgan. */
export function isAging(r: Pick<RequestRow, "status" | "deadline" | "created_at">): boolean {
  if (!isOpen(r.status)) return false;
  const now = new Date();
  if (r.deadline && new Date(r.deadline) < now) return true;
  return daysBetween(now, new Date(r.created_at)) > 7;
}

/** Muddati o'tganmi (deadline o'tgan, hali yopilmagan) */
export function isOverdue(r: Pick<RequestRow, "status" | "deadline">): boolean {
  return isOpen(r.status) && !!r.deadline && new Date(r.deadline) < new Date();
}

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
