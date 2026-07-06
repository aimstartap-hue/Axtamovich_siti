"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function loginAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Email va parolni kiriting." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Email yoki parol noto'g'ri." };
  redirect("/");
}

export async function registerAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const fullName = String(formData.get("full_name") || "").trim();
  const orgName = String(formData.get("org_name") || "").trim();
  if (!email || !password || !orgName || !fullName)
    return { error: "Barcha maydonlarni to'ldiring." };
  if (password.length < 6) return { error: "Parol kamida 6 belgidan iborat bo'lsin." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };
  const userId = data.user?.id;
  if (!userId) return { error: "Foydalanuvchi yaratilmadi. Emailni tasdiqlang." };

  // Korxona yaratish + admin profil (RPC — atomik, RLS ostida ishlashi uchun)
  const { error: rpcError } = await supabase.rpc("bootstrap_org", {
    p_org_name: orgName,
    p_full_name: fullName,
  });
  if (rpcError) return { error: "Korxona yaratishda xatolik: " + rpcError.message };

  revalidatePath("/", "layout");
  redirect("/");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
