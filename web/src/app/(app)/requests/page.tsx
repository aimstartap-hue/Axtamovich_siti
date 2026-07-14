import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { branchLabel } from "@/lib/helpers";
import RequestFilters from "./RequestFilters";
import RequestsBoard, { type RequestsSP } from "./RequestsBoard";
import BoardSkeleton from "./BoardSkeleton";

export default async function RequestsPage({ searchParams }: { searchParams: Promise<RequestsSP> }) {
  await requireProfile();
  const sp = await searchParams;
  const sb = await createClient();
  const { data: branches } = await sb.from("branches").select("id, name");
  const branchList = (branches ?? []).map((b) => ({ id: b.id, name: branchLabel(b.name) }));

  // Filter o'zgarganda Suspense fallback (skeleton) ko'rsatiladi
  const key = [sp.q, sp.status, sp.type, sp.priority, sp.branch, sp.owner, sp.from, sp.to, sp.kpi].map((v) => v ?? "").join("|");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Zayavkalar</h1>
          <p className="text-xs" style={{ color: "var(--muted)" }}>Interaktiv boshqaruv paneli</p>
        </div>
        <Link href="/requests/new" className="btn btn-brand flex items-center gap-1.5 !py-2"><Plus size={16} /> Yangi zayavka</Link>
      </div>

      <RequestFilters branches={branchList} />

      <Suspense key={key} fallback={<BoardSkeleton />}>
        <RequestsBoard sp={sp} branches={branchList} />
      </Suspense>
    </div>
  );
}
