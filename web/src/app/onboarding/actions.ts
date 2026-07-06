"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createOrgAction(_prev: unknown, formData: FormData) {
  const orgName = String(formData.get("org_name") || "").trim();
  const fullName = String(formData.get("full_name") || "").trim();
  if (!orgName || !fullName) return { error: "Barcha maydonlarni to'ldiring." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("bootstrap_org", {
    p_org_name: orgName,
    p_full_name: fullName,
  });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/");
}
