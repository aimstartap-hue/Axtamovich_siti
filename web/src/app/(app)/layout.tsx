import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Shell from "@/components/Shell";

// Har bir so'rovda serverda render (foydalanuvchi sessiyasiga bog'liq)
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: org }, { count }] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", profile.org_id!).single(),
    supabase.from("notifications").select("*", { count: "exact", head: true })
      .eq("user_id", profile.id).eq("is_read", false),
  ]);

  return (
    <Shell
      fullName={profile.full_name}
      role={profile.role}
      orgName={org?.name ?? "Korxona"}
      unread={count ?? 0}
    >
      {children}
    </Shell>
  );
}
