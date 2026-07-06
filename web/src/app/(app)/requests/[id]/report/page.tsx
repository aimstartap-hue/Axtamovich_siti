import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canSubmitReport } from "@/lib/workflow";
import type { RequestRow } from "@/lib/types";
import ReportForm from "./ReportForm";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rid = Number(id);
  const profile = await requireProfile();
  const sb = await createClient();
  const { data } = await sb.from("requests").select("*").eq("id", rid).single();
  if (!data) notFound();
  const req = data as RequestRow;
  if (!canSubmitReport(req, profile.role)) redirect(`/requests/${rid}`);

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">Foto-hisobot — #{req.id}</h1>
      <p className="text-sm text-muted">{req.title}</p>
      <ReportForm requestId={req.id} type={req.type} />
    </div>
  );
}
