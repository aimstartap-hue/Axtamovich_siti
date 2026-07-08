import { describe, it, expect } from "vitest";
import { canonicalize, hashEvent, verifyChain } from "./hash";
import type { DomainEvent } from "./contracts";

// Bu testlar HOZIRGI runtime behaviorni hujjatlaydi. Aniqlangan xavflar (Date,
// NaN/Infinity, sequence/duplicate) it.todo bilan belgilangan va docs/HASH_CHAIN_AUDIT.md
// da tavsiflangan — ular 0008 (Event Store) bosqichida hal qilinadi.

describe("canonicalize — joriy behavior", () => {
  it("kalitlar tartibi natijaga ta'sir qilmaydi", () => {
    expect(canonicalize({ a: 1, b: 2 })).toBe(canonicalize({ b: 2, a: 1 }));
  });
  it("ichma-ich obyekt/massiv", () => {
    expect(canonicalize({ x: [3, { z: 1, y: 2 }] })).toBe('{"x":[3,{"y":2,"z":1}]}');
  });
  it("undefined → 'null'", () => {
    expect(canonicalize(undefined)).toBe("null");
  });

  // --- Aniqlangan xavflar (0008 da hal qilinadi) ---
  it.todo("Date ISO stringga o'girilsin (HOZIR {} — har xil sanalar bir xil hash!)");
  it.todo("NaN/Infinity da throw qilsin (HOZIR 'null' — moliyaviy qiymatni yashiradi)");
});

function makeEvent(seq: number, prevHash: string | null, payload: unknown, id = `evt-${seq}`): DomainEvent {
  const base: Omit<DomainEvent, "hash"> = {
    id, orgId: "org1", aggregateType: "ExpenseRequest", aggregateId: "req1",
    type: "RequestApproved", version: 1, actorId: "u1",
    businessTime: "2026-07-07T10:00:00Z", systemTime: "2026-07-07T10:00:01Z",
    recordedTime: "2026-07-07T10:00:02Z", payload, idempotencyKey: `idem-${id}`,
    sequence: seq, prevHash,
  };
  return { ...base, hash: hashEvent(base) };
}

describe("hashEvent — barqaror", () => {
  it("bir xil kirish → bir xil hash", () => {
    const e = makeEvent(1, null, { amount: 100 });
    const { hash, ...rest } = e;
    expect(hashEvent(rest)).toBe(hash);
  });
});

describe("verifyChain — joriy tamper-evidence", () => {
  it("to'g'ri zanjir — ok", () => {
    const e1 = makeEvent(1, null, { amount: 100 });
    const e2 = makeEvent(2, e1.hash, { amount: 200 });
    const e3 = makeEvent(3, e2.hash, { amount: 300 });
    expect(verifyChain([e1, e2, e3])).toEqual({ ok: true });
  });
  it("payload o'zgartirilsa — zanjir buziladi", () => {
    const e1 = makeEvent(1, null, { amount: 100 });
    const e2 = makeEvent(2, e1.hash, { amount: 200 });
    const tampered = { ...e1, payload: { amount: 999 } };
    expect(verifyChain([tampered, e2])).toEqual({ ok: false, brokenAt: "evt-1" });
  });
  it("prevHash bog'lanishi buzilsa — aniqlanadi", () => {
    const e1 = makeEvent(1, null, { amount: 100 });
    const e2 = makeEvent(2, "soxta-hash", { amount: 200 });
    expect(verifyChain([e1, e2])).toEqual({ ok: false, brokenAt: "evt-2" });
  });
  it("o'rtadan event o'chirilsa — prevHash orqali aniqlanadi", () => {
    const e1 = makeEvent(1, null, { amount: 100 });
    const e2 = makeEvent(2, e1.hash, { amount: 200 });
    const e3 = makeEvent(3, e2.hash, { amount: 300 });
    expect(verifyChain([e1, e3])).toEqual({ ok: false, brokenAt: "evt-3" });
  });

  // --- Aniqlangan xavflar (0008 da hal qilinadi) ---
  it.todo("sequence gap (1→2→4) aniqlansin (HOZIR prevHash to'g'ri bo'lsa o'tib ketadi)");
  it.todo("duplicate sequence (2,2) aniqlansin");
  it.todo("duplicate event id aniqlansin");
});
