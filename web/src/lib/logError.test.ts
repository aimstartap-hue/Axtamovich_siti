import { describe, it, expect, vi } from "vitest";
import { logError } from "./logError";

describe("logError — markaziy xato logi", () => {
  it("Error obyektini structured JSON qilib yozadi (scope, message, level, context)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("test.scope", new Error("boom"), { id: 5 });
    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.scope).toBe("test.scope");
    expect(parsed.message).toBe("boom");
    expect(parsed.level).toBe("error");
    expect(parsed.id).toBe(5);
    expect(typeof parsed.at).toBe("string"); // timestamp
    spy.mockRestore();
  });

  it("string yoki noma'lum xato bilan ham throw qilmaydi (fail-safe)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => logError("s", "oddiy matn xato")).not.toThrow();
    expect(() => logError("s", { weird: true })).not.toThrow();
    expect(() => logError("s", null)).not.toThrow();
    const first = JSON.parse(spy.mock.calls[0][0] as string);
    expect(first.message).toBe("oddiy matn xato");
    spy.mockRestore();
  });

  it("context bo'lmasa ham ishlaydi", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("no.ctx", new Error("x"));
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});
