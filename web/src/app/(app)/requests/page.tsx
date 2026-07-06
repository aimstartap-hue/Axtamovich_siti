import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import RequestCard from "@/components/RequestCard";
import RequestFilters from "./RequestFilters";
import type { RequestRow } from "@/lib/types";

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string }>;
}) {
  await requireProfile();
  const sp = await searchParams;
  const sb = await createClient();

  let query = sb.from("requests").select("*").order("id", { ascending: false });
  if (sp.status) query = query.eq("status", sp.status);
  if (sp.type) query = query.eq("type", sp.type);
  const { data } = await query;
  let list = (data ?? []) as RequestRow[];
  if (sp.q) {
    const q = sp.q.toLowerCase();
    list = list.filter((r) => r.title.toLowerCase().includes(q) || String(r.id) === q);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Zayavkalar</h1>
        <Link href="/requests/new" className="btn btn-brand">+ Yangi</Link>
      </div>

      <RequestFilters />

      <div className="space-y-2">
        {list.map((r) => <RequestCard key={r.id} r={r} />)}
        {list.length === 0 && <div className="card p-6 text-center text-muted text-sm">Zayavka topilmadi.</div>}
      </div>
    </div>
  );
}
