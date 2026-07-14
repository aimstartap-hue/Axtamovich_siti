"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { roleHasPerm } from "@/lib/perms";
import { logAudit } from "@/lib/audit";
import { fetchCbuRates, TRACKED_CURRENCIES } from "@/lib/currency";
import { FINANCE_ROLES } from "@/lib/constants";

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
  await logAudit(sb, profile.org_id, profile.id, "threshold", `CEO chegarasi ${Number(value).toLocaleString("ru-RU")} so'm ga o'zgartirildi`);
  revalidatePath("/");
  revalidatePath("/admin");
}

/** Valyuta kurslarini CBU'dan yangilash (punkt 4). */
export async function updateRates() {
  const profile = await requireProfile();
  if (!FINANCE_ROLES.includes(profile.role)) return;
  const sb = await createClient();
  let rates: Record<string, number>;
  try {
    rates = await fetchCbuRates();
  } catch {
    return; // CBU javob bermadi — jimgina o'tadi
  }
  const rows = TRACKED_CURRENCIES.filter((c) => rates[c]).map((c) => ({
    org_id: profile.org_id, currency: c, rate: rates[c], updated_at: new Date().toISOString(),
  }));
  if (rows.length) await sb.from("exchange_rates").upsert(rows, { onConflict: "org_id,currency" });
  revalidatePath("/");
}
