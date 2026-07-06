"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { roleHasPerm } from "@/lib/perms";

/** CEO summa chegarasini saqlash — faqat 'manage_ceo_threshold' huquqiga ega rollar (punkt 18). */
export async function saveThreshold(formData: FormData) {
  const profile = await requireProfile();
  const sb = await createClient();
  if (!(await roleHasPerm(sb, profile.org_id, profile.role, "manage_ceo_threshold"))) return;
  const value = String(formData.get("ceo_threshold") || "").replace(/[^\d]/g, "");
  if (!value) return;
  await sb.from("org_settings").upsert(
    { org_id: profile.org_id, key: "ceo_threshold", value }, { onConflict: "org_id,key" },
  );
  revalidatePath("/analytics");
  revalidatePath("/admin");
}
