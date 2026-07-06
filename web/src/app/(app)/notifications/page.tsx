import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/workflow";

async function markAllRead() {
  "use server";
  const profile = await requireProfile();
  const sb = await createClient();
  await sb.from("notifications").update({ is_read: true }).eq("user_id", profile.id).eq("is_read", false);
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export default async function NotificationsPage() {
  const profile = await requireProfile();
  const sb = await createClient();
  const { data: items } = await sb.from("notifications")
    .select("*").eq("user_id", profile.id).order("id", { ascending: false }).limit(100);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Bildirishnomalar</h1>
        <form action={markAllRead}>
          <button className="btn btn-ghost text-sm">Hammasini o'qilgan qilish</button>
        </form>
      </div>
      <div className="space-y-2">
        {(items ?? []).map((n) => (
          <Link key={n.id} href={n.request_id ? `/requests/${n.request_id}` : "#"}
            className={`card p-3 flex items-center gap-3 hover:bg-surface-2 ${n.is_read ? "opacity-60" : "border-brand/40"}`}>
            {!n.is_read && <span className="w-2 h-2 rounded-full bg-brand shrink-0" />}
            <div className="flex-1">
              <div className="text-sm">{n.text}</div>
              <div className="text-xs text-muted">{formatDate(n.created_at)}</div>
            </div>
          </Link>
        ))}
        {(items ?? []).length === 0 && <div className="card p-6 text-center text-muted text-sm">Bildirishnoma yo'q.</div>}
      </div>
    </div>
  );
}
