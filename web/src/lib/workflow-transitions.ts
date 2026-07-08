// =============================================================================
// Workflow state-machine — RUXSAT ETILGAN holat o'tishlari (yagona manba).
//
// Maqsad (Reliability / Control): pul-oqimi holat-mashinasini bitta joyda,
// aniq e'lon qilish. Har qanday holat o'zgarishi shu grafga mos bo'lishi kerak.
// Bu — actions.ts dagi imperativ oqimning DEKLARATIV nusxasi; test ular
// bir-biriga mos ekanini tekshiradi (drift tutiladi).
//
// ESLATMA: hozir runtime'ga ulanmagan (deploy bloklangan). Deploy ochilgach
// isValidTransition() actions.ts da guard sifatida ishlatiladi.
// =============================================================================

export type WorkflowStatus =
  | "pending_axo" | "pending_ceo" | "pending_finance" | "deadline_dispute"
  | "approved" | "funded" | "manager_doing" | "axo_review"
  | "report_submitted" | "closed" | "rejected" | "hr_review";

/** from-holatdan ruxsat etilgan to-holatlar. Bo'sh massiv = terminal holat. */
export const ALLOWED_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  pending_axo:      ["pending_ceo", "pending_finance", "manager_doing", "rejected"],
  pending_ceo:      ["pending_finance", "rejected"],
  pending_finance:  ["approved", "funded", "deadline_dispute", "rejected"],
  deadline_dispute: ["pending_finance"],
  approved:         ["report_submitted"],
  funded:           ["report_submitted"],
  manager_doing:    ["axo_review"],
  axo_review:       ["report_submitted"],
  report_submitted: ["closed", "rejected"],
  rejected:         ["pending_axo", "hr_review"],
  hr_review:        ["closed"],
  closed:           [], // terminal
};

export function isValidTransition(from: string, to: string): boolean {
  const allowed = ALLOWED_TRANSITIONS[from as WorkflowStatus];
  return !!allowed && allowed.includes(to as WorkflowStatus);
}

export function isTerminal(status: string): boolean {
  const allowed = ALLOWED_TRANSITIONS[status as WorkflowStatus];
  return !!allowed && allowed.length === 0;
}
