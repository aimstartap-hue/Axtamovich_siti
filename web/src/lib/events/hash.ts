// =============================================================================
// Event hash-zanjiri — pure, tamper-evidence yadrosi (Blueprint §8).
// Har event oldingisining hashini o'z ichiga oladi. Bitta yozuvni o'zgartirsang,
// butun zanjir buziladi. Bu fayl pure — hech qayerga ulanmagan (deploy ochilgach
// Event Store shundan foydalanadi).
// =============================================================================
import { createHash } from "node:crypto";
import type { DomainEvent } from "./contracts";

/** Deterministik JSON — kalitlar tartibidan qat'i nazar bir xil natija. */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize(obj[k])).join(",") + "}";
}

/** Event hashi = sha256(canonical(event 'hash' maydonisiz)). prevHash event ichida. */
export function hashEvent(event: Omit<DomainEvent, "hash">): string {
  return createHash("sha256").update(canonicalize(event)).digest("hex");
}

/**
 * Zanjir yaxlitligini tekshiradi: har event to'g'ri prevHash ga bog'langan va
 * hashi o'z mazmuniga mos. Buzilgan joyni qaytaradi (tamper-evidence).
 */
export function verifyChain(events: DomainEvent[]): { ok: boolean; brokenAt?: string } {
  let prev: string | null = null;
  for (const e of events) {
    if (e.prevHash !== prev) return { ok: false, brokenAt: e.id };
    const { hash, ...rest } = e;
    if (hashEvent(rest) !== hash) return { ok: false, brokenAt: e.id };
    prev = e.hash;
  }
  return { ok: true };
}
