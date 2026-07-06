import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

/** Joriy foydalanuvchi profili (org_id, role bilan). Yo'q bo'lsa login'ga yuboradi. */
export async function requireProfile(): Promise<Profile> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, org_id, full_name, role, branch_id")
    .eq("id", user.id)
    .single();

  // Profil bor, lekin org tanlanmagan bo'lsa — onboarding
  if (!profile) redirect("/onboarding");
  if (!profile.org_id) redirect("/onboarding");
  return profile as Profile;
}

/** Profilni olish (redirect qilmasdan). */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, org_id, full_name, role, branch_id")
    .eq("id", user.id)
    .single();
  return (data as Profile) ?? null;
}
