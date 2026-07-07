import { describe, it, expect } from "vitest";
import { roleHasPerm } from "./perms";

// Avtorizatsiya — nazorat-kritik. orgId=null bo'lsa roleHasPerm DB'ni chetlab,
// DEFAULT_PERMS (kodda belgilangan standart) ga tayanadi. Shu fallback tekshiriladi.
// (DB yozuvi bo'lgan holat integration testda; bu — sof qoida.)
const sb = {} as unknown as Parameters<typeof roleHasPerm>[0];

describe("roleHasPerm — DEFAULT_PERMS fallback (orgId yo'q)", () => {
  it("admin — manage_ceo_threshold huquqiga ega (standart)", async () => {
    expect(await roleHasPerm(sb, null, "admin", "manage_ceo_threshold")).toBe(true);
  });
  it("finance — manage_ceo_threshold standart yo'q (admin bermaguncha)", async () => {
    expect(await roleHasPerm(sb, null, "finance", "manage_ceo_threshold")).toBe(false);
  });
  it("finance — manage_limits standart bor", async () => {
    expect(await roleHasPerm(sb, null, "finance", "manage_limits")).toBe(true);
  });
  it("branch_manager — manage_settings yo'q", async () => {
    expect(await roleHasPerm(sb, null, "branch_manager", "manage_settings")).toBe(false);
  });
  it("noma'lum perm — hech kimга yo'q", async () => {
    expect(await roleHasPerm(sb, null, "admin", "nonexistent_perm")).toBe(false);
  });
});
