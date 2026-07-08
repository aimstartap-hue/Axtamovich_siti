// =============================================================================
// Audit & Event Core — KONTRAKTLAR (interfeyslar). Faqat turlar; runtime yo'q.
// Blueprint §6 (Event Philosophy), ADR-003 (Selective Event Sourcing) asosida.
//
// Bu fayl platformaning event-modeli "shartnomasi". Kelajakdagi Event Store
// implementatsiyasi shu kontraktlarni bajaradi. Hozir hech qayerga ulanmagan.
// =============================================================================

/**
 * Command — holatni o'zgartirishga NIYAT. Rad etilishi mumkin; saqlanmaydi.
 * (Blueprint §6)
 */
export interface Command<TPayload = unknown> {
  type: string;                 // "ApproveRequest"
  orgId: string;                // tenant izolyatsiyasi
  actorId: string | null;       // kim so'radi (accountability)
  aggregateType: string;        // "ExpenseRequest"
  aggregateId: string;          // qaysi obyekt
  payload: TPayload;
  idempotencyKey: string;       // qayta yuborish/kech-sync dublikatini to'sadi
  businessTime?: string;        // real dunyoda qachon (ixtiyoriy; odam da'vosi)
}

/**
 * DomainEvent — SODIR BO'LGAN o'zgarmas fakt. Append-only, tahrirlanmaydi.
 * Haqiqat manbai. (Blueprint §3, §6)
 */
export interface DomainEvent<TPayload = unknown> {
  id: string;                   // global noyob event id
  orgId: string;                // tenant izolyatsiyasi
  aggregateType: string;
  aggregateId: string;
  type: string;                 // "RequestApproved"
  version: number;              // event sxema versiyasi (backward compat / upcasting)
  actorId: string | null;       // accountability

  // Uch vaqt (Blueprint §6 — Time Principle)
  businessTime: string;         // real dunyoda qachon sodir bo'ldi
  systemTime: string;           // tizim qaror qilgan vaqt
  recordedTime: string;         // buzilmas yozilgan vaqt (Store qo'yadi)

  payload: TPayload;
  idempotencyKey: string;
  sequence: number;             // append tartibi (Store beradi)

  // Tamper-evidence (Blueprint §8) — hash-zanjir
  prevHash: string | null;
  hash: string;

  // Compensation (Blueprint §6) — xato yangi event bilan tuzatiladi
  isCompensation?: boolean;
  compensates?: string;         // tuzatilayotgan event id
}

/** Store'ga beriladigan yangi event (hash/sequence/recordedTime Store qo'yadi). */
export type NewEvent<TPayload = unknown> = Omit<
  DomainEvent<TPayload>,
  "recordedTime" | "sequence" | "prevHash" | "hash"
>;

/** Backward Compatibility (Strategic Amendment 002) — eski eventni yangi shaklga o'girish. */
export type Upcaster = (raw: unknown) => DomainEvent;

/**
 * Event Store — KONTRAKT. Faqat APPEND va READ. update/delete YO'Q (append-only).
 * verifyChain — hash-zanjir yaxlitligini tekshiradi (tamper-evidence).
 */
export interface EventStore {
  append(events: NewEvent[]): Promise<DomainEvent[]>;
  readStream(orgId: string, aggregateType: string, aggregateId: string): Promise<DomainEvent[]>;
  readByOrg(orgId: string, opts?: { types?: string[]; sinceSequence?: number; limit?: number }): Promise<DomainEvent[]>;
  verifyChain(orgId: string): Promise<{ ok: boolean; brokenAt?: string }>;
}
