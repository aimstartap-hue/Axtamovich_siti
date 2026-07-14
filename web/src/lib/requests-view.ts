// =============================================================================
// Zayavkalar jadvali — sof ko'rinish (view) yordamchilari. I/O yo'q, test qilinadi.
// CFO/Moliya 10 soniyada holatni tushunishi uchun status/prioritet/SLA/mas'ul
// mantiqini bir joyda saqlaydi.
// =============================================================================
import { STATUS_LABELS, PRIORITY_LABELS, type Priority } from "./constants";
import { isOpen } from "./helpers";

export type Tone = "green" | "blue" | "amber" | "orange" | "red" | "gray";
export interface Chip { label: string; tone: Tone }

// Status -> rangli guruh (🟢 tugallangan · 🔵 jarayonda · 🟡 tasdiq kutmoqda ·
// 🟠 to'lov/tekshiruv kutmoqda · ⚫ rad etilgan). Aniq yorliq STATUS_LABELS'dan.
const STATUS_TONE: Record<string, Tone> = {
  closed: "green",
  approved: "blue", manager_doing: "blue", axo_review: "blue", funded: "blue",
  pending_axo: "amber", pending_ceo: "amber", pending_finance: "amber",
  pending_approval: "amber", deadline_dispute: "amber", hr_review: "amber",
  report_submitted: "orange",
  rejected: "gray",
};

export function statusView(status: string): Chip {
  return { label: STATUS_LABELS[status] ?? status, tone: STATUS_TONE[status] ?? "blue" };
}

// Prioritet: real bazada urgent/normal/low. Enterprise badge.
const PRIORITY_TONE: Record<Priority, Tone> = { urgent: "red", normal: "blue", low: "gray" };
export function priorityView(priority: Priority | null): Chip | null {
  if (!priority) return null;
  return { label: PRIORITY_LABELS[priority], tone: PRIORITY_TONE[priority] };
}

// SLA — deadline holati. Ochiq zayavka uchun: qoldi / bugun / kechikdi.
export function slaView(
  deadline: string | null,
  status: string,
  now: Date = new Date(),
): Chip | null {
  if (!deadline) return null;
  if (!isOpen(status)) return null; // yopilgan/rad — SLA yo'q
  const d0 = new Date(deadline); d0.setHours(0, 0, 0, 0);
  const t0 = new Date(now); t0.setHours(0, 0, 0, 0);
  const days = Math.round((d0.getTime() - t0.getTime()) / 86_400_000);
  if (days < 0) return { label: `${Math.abs(days)} kun kechikdi`, tone: "red" };
  if (days === 0) return { label: "Bugun", tone: "orange" };
  if (days <= 2) return { label: `${days} kun qoldi`, tone: "amber" };
  return { label: `${days} kun qoldi`, tone: "green" };
}

// Mas'ul — hozir kim harakat qilishi kerak (status bo'yicha). Nazorat uchun.
const OWNER: Record<string, string> = {
  pending_axo: "AXO", pending_ceo: "CEO", pending_finance: "Moliya",
  approved: "AXO", manager_doing: "Menejer", axo_review: "AXO",
  report_submitted: "Moliya / CEO", deadline_dispute: "CEO",
  funded: "Open group", hr_review: "HR",
};
export function currentOwner(status: string): string | null {
  return OWNER[status] ?? null;
}

// Nisbiy vaqt: "bugun" · "kecha" · "N kun oldin" · "N hafta oldin"
export function relativeTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "—";
  const days = Math.floor((now.getTime() - t) / 86_400_000);
  if (days <= 0) return "bugun";
  if (days === 1) return "kecha";
  if (days < 7) return `${days} kun oldin`;
  if (days < 30) return `${Math.floor(days / 7)} hafta oldin`;
  if (days < 365) return `${Math.floor(days / 30)} oy oldin`;
  return `${Math.floor(days / 365)} yil oldin`;
}
