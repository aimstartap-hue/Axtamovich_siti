// =============================================================================
// Rol qobiliyatlarini tekshirish — role_perms jadvali, yo'q bo'lsa DEFAULT_PERMS.
// =============================================================================
import { DEFAULT_PERMS, type Role } from "./constants";
import type { createClient } from "./supabase/server";

type SB = Awaited<ReturnType<typeof createClient>>;

/** Shu rol berilgan qobiliyatga (perm) ega-emasligini aniqlaydi. */
export async function roleHasPerm(sb: SB, orgId: string | null, role: Role, perm: string): Promise<boolean> {
  if (orgId) {
    const { data } = await sb
      .from("role_perms")
      .select("allowed")
      .eq("org_id", orgId).eq("role", role).eq("perm", perm)
      .maybeSingle();
    if (data) return !!data.allowed;
  }
  return (DEFAULT_PERMS[perm] ?? []).includes(role);
}
