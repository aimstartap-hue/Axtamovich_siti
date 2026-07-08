import { describe, it, expect } from "vitest";
import { canonicalize, hashEvent, verifyChain } from "./hash";
import type { DomainEvent } from "./contracts";

describe("canonicalize — deterministik va xavfsiz", () => {
  it("kalitlar tartibi natijaga ta'sir qilmaydi", () => {
    expect(canonicalize({ a: 1, b: 2 })).toBe(canonicalize({ b: 2, a: 1 }));
  });
  it("ichma-ich obyekt/massiv", () => {
    expect(canonicalize({ x: [3, { z: 1, y: 2 }] })).toBe('{"x":[3,{"y":2,"z":1}]}');
  });
  it("undefined → 'null' (barqaror)", () => {
    expect(canonicalize(undefined)).toBe("null");
    expect(canonicalize({ a: undefined })).toBe('{"a":null}');
  });
  it("Date → ISO string (aks holda {} bo'lib har xil sanalar bir xil hash berardi)", () => {
    expect(canonicalize(new Date("2026-07-07T00:00:00Z"))).toBe('"2026-07-07T00:00:00.000Z"');
    // Ikki HAR XIL sana — HAR XIL natija (regressiya himoyasi)
    expect(canonicalize(new Date("2026-01-01"))).not.toBe(canonicalize(new Date("2026-02-01")));
  });
  it("NaN / Infinity — throw (moliyaviy qiymatni jim yashirmaydi)", () => {
    expect(() => canonicalize(NaN)).toThrow();
    expect(() => canonicalize(Infinity)).toThrow();
    expect(() => canonicalize({ amount: NaN })).toThrow();
  });
});

// To'g'ri hashlangan event quruvchi (id ni ham override qilsa bo'ladi).
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

describe("verifyChain — tamper-evidence", () => {
  it("to'g'ri zanjir — ok", () => {
    const e1 = makeEvent(1, null, { amount: 100 });
    const e2 = makeEvent(2, e1.hash, { amount: 200 });
    const e3 = makeEvent(3, e2.hash, { amount: 300 });
    expect(verifyChain([e1, e2, e3])).toEqual({ ok: true });
  });

  it("payload o'zgartirilsa — hash_mismatch", () => {
    const e1 = makeEvent(1, null, { amount: 100 });
    const e2 = makeEvent(2, e1.hash, { amount: 200 });
    const tampered = { ...e1, payload: { amount: 999 } };
    expect(verifyChain([tampered, e2])).toMatchObject({ ok: false, brokenAt: "evt-1", reason: "hash_mismatch" });
  });

  it("prevHash bog'lanishi buzilsa — prev_hash_mismatch", () => {
    const e1 = makeEvent(1, null, { amount: 100 });
    const e2 = makeEvent(2, "soxta-hash", { amount: 200 });
    expect(verifyChain([e1, e2])).toMatchObject({ ok: false, brokenAt: "evt-2", reason: "prev_hash_mismatch" });
  });

  it("o'rtadan event o'chirilsa — sequence uziladi", () => {
    const e1 = makeEvent(1, null, { amount: 100 });
    const e2 = makeEvent(2, e1.hash, { amount: 200 });
    const e3 = makeEvent(3, e2.hash, { amount: 300 });
    expect(verifyChain([e1, e3])).toMatchObject({ ok: false, brokenAt: "evt-3", reason: "sequence_break" });
  });

  it("sequence uzilishi (1→2→4) — sequence_break", () => {
    const e1 = makeEvent(1, null, { amount: 1 });
    const e2 = makeEvent(2, e1.hash, { amount: 2 });
    const e4 = makeEvent(4, e2.hash, { amount: 4 });
    expect(verifyChain([e1, e2, e4])).toMatchObject({ ok: false, brokenAt: "evt-4", reason: "sequence_break" });
  });

  it("dublikat sequence (2,2) — sequence_break", () => {
    const e1 = makeEvent(1, null, { amount: 1 });
    const e2 = makeEvent(2, e1.hash, { amount: 2 });
    const dup = makeEvent(2, e2.hash, { amount: 3 }, "evt-2b"); // seq 2 takror, boshqa id
    expect(verifyChain([e1, e2, dup])).toMatchObject({ ok: false, brokenAt: "evt-2b", reason: "sequence_break" });
  });

  it("dublikat event id — duplicate_id", () => {
    const e1 = makeEvent(1, null, { amount: 1 });
    const clone = makeEvent(2, e1.hash, { amount: 2 }, "evt-1"); // id takror
    expect(verifyChain([e1, clone])).toMatchObject({ ok: false, brokenAt: "evt-1", reason: "duplicate_id" });
  });
});
