import { describe, it, expect } from "vitest";
import { canonicalize, hashEvent, verifyChain } from "./hash";
import type { DomainEvent } from "./contracts";

describe("canonicalize — deterministik", () => {
  it("kalitlar tartibi natijaga ta'sir qilmaydi", () => {
    expect(canonicalize({ a: 1, b: 2 })).toBe(canonicalize({ b: 2, a: 1 }));
  });
  it("ichma-ich obyekt/massiv", () => {
    expect(canonicalize({ x: [3, { z: 1, y: 2 }] })).toBe('{"x":[3,{"y":2,"z":1}]}');
  });
});

// Test uchun to'g'ri hashlangan zanjir quruvchi.
function makeEvent(seq: number, prevHash: string | null, payload: unknown): DomainEvent {
  const base: Omit<DomainEvent, "hash"> = {
    id: `evt-${seq}`, orgId: "org1", aggregateType: "ExpenseRequest", aggregateId: "req1",
    type: "RequestApproved", version: 1, actorId: "u1",
    businessTime: "2026-07-07T10:00:00Z", systemTime: "2026-07-07T10:00:01Z",
    recordedTime: "2026-07-07T10:00:02Z", payload, idempotencyKey: `idem-${seq}`,
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

describe("verifyChain — tamper-evidence", () => {
  it("to'g'ri zanjir — ok", () => {
    const e1 = makeEvent(1, null, { amount: 100 });
    const e2 = makeEvent(2, e1.hash, { amount: 200 });
    const e3 = makeEvent(3, e2.hash, { amount: 300 });
    expect(verifyChain([e1, e2, e3])).toEqual({ ok: true });
  });

  it("payload o'zgartirilsa — zanjir buziladi", () => {
    const e1 = makeEvent(1, null, { amount: 100 });
    const e2 = makeEvent(2, e1.hash, { amount: 200 });
    // Auditor 'e1' summasini yashirincha o'zgartirmoqchi (hashni yangilamasdan)
    const tampered = { ...e1, payload: { amount: 999 } };
    expect(verifyChain([tampered, e2])).toEqual({ ok: false, brokenAt: "evt-1" });
  });

  it("prevHash bog'lanishi buzilsa — aniqlanadi", () => {
    const e1 = makeEvent(1, null, { amount: 100 });
    const e2 = makeEvent(2, "soxta-hash", { amount: 200 }); // noto'g'ri bog'lanish
    expect(verifyChain([e1, e2])).toEqual({ ok: false, brokenAt: "evt-2" });
  });

  it("o'rtadan event o'chirilsa — zanjir uziladi", () => {
    const e1 = makeEvent(1, null, { amount: 100 });
    const e2 = makeEvent(2, e1.hash, { amount: 200 });
    const e3 = makeEvent(3, e2.hash, { amount: 300 });
    // e2 o'chirildi — e3.prevHash endi mos kelmaydi
    expect(verifyChain([e1, e3])).toEqual({ ok: false, brokenAt: "evt-3" });
  });
});
