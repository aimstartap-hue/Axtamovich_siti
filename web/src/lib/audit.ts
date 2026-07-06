// =============================================================================
// Audit jurnali — byudjet/limit/sozlama o'zgarishlarini yozib boradi (punkt 19).
// =============================================================================
import type { createClient } from "./supabase/server";

type SB = Awaited<ReturnType<typeof createClient>>;

export async function logAudit(sb: SB, orgId: string | null, actorId: string, action: string, detail: string) {
  if (!orgId) return;
  // audit_log jadvali bo'lmasa (0006 migratsiya hali ishga tushmagan) — jimgina o'tadi.
  try {
    await sb.from("audit_log").insert({ org_id: orgId, actor_id: actorId, action, detail });
  } catch { /* migratsiya hali yo'q */ }
}
