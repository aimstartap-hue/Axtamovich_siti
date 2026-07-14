"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { ADMIN_ROLES, ROLES, PERMS, type Role } from "@/lib/constants";

async function guardAdmin() {
  const profile = await requireProfile();
  if (!ADMIN_ROLES.includes(profile.role)) throw new Error("Ruxsat yo'q");
  return profile;
}

// --- FILIALLAR --------------------------------------------------------------
export async function addBranch(formData: FormData) {
  const profile = await guardAdmin();
  const sb = await createClient();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await sb.from("branches").insert({
    org_id: profile.org_id, name,
    status: String(formData.get("status") || "active"),
  });
  revalidatePath("/admin");
}

export async function setBranchStatus(formData: FormData) {
  await guardAdmin();
  const sb = await createClient();
  await sb.from("branches").update({ status: String(formData.get("status")) })
    .eq("id", Number(formData.get("id")));
  revalidatePath("/admin");
}

export async function deleteBranch(formData: FormData) {
  await guardAdmin();
  const sb = await createClient();
  await sb.from("branches").delete().eq("id", Number(formData.get("id")));
  revalidatePath("/admin");
}

// --- FOYDALANUVCHILAR (taklif qilish) ---------------------------------------
export async function inviteUser(_prev: unknown, formData: FormData) {
  const profile = await guardAdmin();
  const email = String(formData.get("email") || "").trim();
  const fullName = String(formData.get("full_name") || "").trim();
  const role = String(formData.get("role") || "branch_manager") as Role;
  const branchId = formData.get("branch_id") ? Number(formData.get("branch_id")) : null;
  const password = String(formData.get("password") || "").trim();
  if (!email || !fullName || !password) return { error: "Email, ism va parolni kiriting." };
  if (password.length < 6) return { error: "Parol kamida 6 belgi." };

  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error) return { error: error.message };

  const { error: pErr } = await admin.from("profiles").insert({
    id: created.user.id, org_id: profile.org_id, full_name: fullName, role, branch_id: branchId,
  });
  if (pErr) return { error: pErr.message };

  revalidatePath("/admin");
  return { ok: true, message: `${fullName} qo'shildi.` };
}

export async function deleteUser(formData: FormData) {
  const profile = await guardAdmin();
  const id = String(formData.get("id"));
  if (id === profile.id) return; // o'zini o'chirmaydi
  const admin = createAdminClient();
  await admin.from("profiles").delete().eq("id", id);
  await admin.auth.admin.deleteUser(id);
  revalidatePath("/admin");
}

// --- SOZLAMALAR -------------------------------------------------------------
export async function saveSettings(formData: FormData) {
  const profile = await guardAdmin();
  const sb = await createClient();
  const entries: [string, string][] = [
    ["ceo_threshold", String(formData.get("ceo_threshold") || "50000000")],
    ["axo_open_limit", String(formData.get("axo_open_limit") || "5")],
  ];
  for (const [key, value] of entries) {
    await sb.from("org_settings").upsert(
      { org_id: profile.org_id, key, value }, { onConflict: "org_id,key" },
    );
  }
  revalidatePath("/admin");
}

// --- GENERIC KONFIGURATSIYA (org_settings key/value) ------------------------
// Har form `set_<key>` maydonlar yuboradi. Checkbox kalitlari `_cb` da ro'yxatlanadi
// (belgilanmagan checkbox = "0"). Barchasi bitta upsert + audit.
export async function saveConfig(formData: FormData) {
  const profile = await guardAdmin();
  const sb = await createClient();
  const updates: { org_id: string | null; key: string; value: string }[] = [];
  const changed = new Set<string>();
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("set_")) { const key = k.slice(4); updates.push({ org_id: profile.org_id, key, value: String(v) }); changed.add(key); }
  }
  for (const key of String(formData.get("_cb") || "").split(",").filter(Boolean)) {
    if (!changed.has(key)) { updates.push({ org_id: profile.org_id, key, value: "0" }); changed.add(key); }
  }
  if (updates.length) await sb.from("org_settings").upsert(updates, { onConflict: "org_id,key" });
  await logAudit(sb, profile.org_id, profile.id, "settings", `Sozlama yangilandi: ${[...changed].join(", ")}`);
  revalidatePath("/admin");
}

// Tashkilot: nom -> organizations jadvali + qolgan maydonlar org_settings
export async function saveOrg(formData: FormData) {
  const profile = await guardAdmin();
  const sb = await createClient();
  const name = String(formData.get("set_org_name") || "").trim();
  if (name) await sb.from("organizations").update({ name }).eq("id", profile.org_id);
  const updates: { org_id: string | null; key: string; value: string }[] = [];
  for (const [k, v] of formData.entries()) if (k.startsWith("set_")) updates.push({ org_id: profile.org_id, key: k.slice(4), value: String(v) });
  if (updates.length) await sb.from("org_settings").upsert(updates, { onConflict: "org_id,key" });
  await logAudit(sb, profile.org_id, profile.id, "settings", "Tashkilot ma'lumotlari yangilandi");
  revalidatePath("/admin");
  revalidatePath("/", "layout");
}

// Plugin manager: modul yoqish/o'chirish
export async function toggleModule(formData: FormData) {
  const profile = await guardAdmin();
  const sb = await createClient();
  const mod = String(formData.get("module"));
  const on = formData.get("on") === "1";
  await sb.from("org_settings").upsert({ org_id: profile.org_id, key: `module_${mod}`, value: on ? "1" : "0" }, { onConflict: "org_id,key" });
  await logAudit(sb, profile.org_id, profile.id, "module", `Modul "${mod}" ${on ? "yoqildi" : "o'chirildi"}`);
  revalidatePath("/admin");
}

// Tizim: cache tozalash
export async function clearCache() {
  const profile = await guardAdmin();
  const sb = await createClient();
  revalidatePath("/", "layout");
  await logAudit(sb, profile.org_id, profile.id, "system", "Cache tozalandi");
  revalidatePath("/admin");
}

// Backup belgisi (Supabase avtomat backup qiladi; bu — qo'lда marker + audit)
export async function runBackup() {
  const profile = await guardAdmin();
  const sb = await createClient();
  await sb.from("org_settings").upsert({ org_id: profile.org_id, key: "last_backup", value: new Date().toISOString() }, { onConflict: "org_id,key" });
  await logAudit(sb, profile.org_id, profile.id, "backup", "Qo'lda backup belgisi qo'yildi");
  revalidatePath("/admin");
}

// --- RUXSATLAR --------------------------------------------------------------
export async function togglePerm(formData: FormData) {
  const profile = await guardAdmin();
  const sb = await createClient();
  const role = String(formData.get("role"));
  const perm = String(formData.get("perm"));
  const allowed = formData.get("allowed") === "1";
  await sb.from("role_perms").upsert(
    { org_id: profile.org_id, role, perm, allowed }, { onConflict: "org_id,role,perm" },
  );
  await logAudit(sb, profile.org_id, profile.id, "perm",
    `${ROLES[role as Role] ?? role}: "${PERMS[perm] ?? perm}" ${allowed ? "yoqildi" : "o'chirildi"}`);
  revalidatePath("/admin");
}
