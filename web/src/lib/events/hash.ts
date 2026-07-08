// =============================================================================
// Event hash-zanjiri — pure, tamper-evidence yadrosi (Blueprint §8).
// Har event oldingisining hashini o'z ichiga oladi. Bitta yozuvni o'zgartirsang,
// butun zanjir buziladi. Bu fayl pure — hech qayerga ulanmagan (deploy ochilgach
// Event Store shundan foydalanadi).
// =============================================================================
import { createHash } from "node:crypto";
import type { DomainEvent } from "./contracts";

/**
 * Deterministik JSON — kalitlar tartibidan qat'i nazar bir xil natija.
 * Xavfsizlik: NaN/Infinity hashlab bo'lmaydi (jim `null` ga aylanib moliyaviy
 * qiymatni yashirmasligi uchun throw qiladi). Date — ISO stringga (aks holda `{}`
 * bo'lib har xil sanalar bir xil hash berardi).
 */
export function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return "null";
  const t = typeof value;
  if (t === "number") {
    if (!Number.isFinite(value as number)) throw new Error("canonicalize: NaN/Infinity hashlab bo'lmaydi");
    return JSON.stringify(value);
  }
  if (t === "bigint") return JSON.stringify((value as bigint).toString());
  if (t === "string" || t === "boolean") return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize(obj[k])).join(",") + "}";
}

/** Event hashi = sha256(canonical(event 'hash' maydonisiz)). prevHash event ichida. */
export function hashEvent(event: Omit<DomainEvent, "hash">): string {
  return createHash("sha256").update(canonicalize(event)).digest("hex");
}

export type ChainResult = { ok: boolean; brokenAt?: string; reason?: string };

/**
 * Zanjir yaxlitligini tekshiradi. Aniqlanadigan buzilishlar:
 *  - duplicate_id      — bir event id ikki marta
 *  - sequence_break    — uzilish (1→2→4) yoki takror (2,2) yoki tartibsizlik
 *  - prev_hash_mismatch— noto'g'ri bog'lanish (o'chirilgan/qo'shilgan yozuv)
 *  - hash_mismatch     — mazmun o'zgartirilgan (tamper)
 */
export function verifyChain(events: DomainEvent[]): ChainResult {
  let prevHash: string | null = null;
  let prevSeq: number | null = null;
  const seenIds = new Set<string>();
  for (const e of events) {
    if (seenIds.has(e.id)) return { ok: false, brokenAt: e.id, reason: "duplicate_id" };
    seenIds.add(e.id);
    if (prevSeq !== null && e.sequence !== prevSeq + 1) return { ok: false, brokenAt: e.id, reason: "sequence_break" };
    if (e.prevHash !== prevHash) return { ok: false, brokenAt: e.id, reason: "prev_hash_mismatch" };
    const { hash, ...rest } = e;
    if (hashEvent(rest) !== hash) return { ok: false, brokenAt: e.id, reason: "hash_mismatch" };
    prevHash = e.hash;
    prevSeq = e.sequence;
  }
  return { ok: true };
}
