import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import NewRequestForm from "./NewRequestForm";

export default async function NewRequestPage() {
  const profile = await requireProfile();
  const sb = await createClient();

  const [{ data: branches }, { data: perms }, { data: org }] = await Promise.all([
    sb.from("branches").select("id, name, status").order("name"),
    sb.from("role_perms").select("perm, allowed").eq("role", profile.role),
    sb.from("organizations").select("name").eq("id", profile.org_id!).maybeSingle(),
  ]);

  const permMap = new Map((perms ?? []).map((p) => [p.perm, p.allowed]));
  const canMaintenance = permMap.get("create_maintenance") ?? false;
  const canNewBranch = permMap.get("create_new_branch") ?? false;

  if (!canMaintenance && !canNewBranch) {
    return <div className="max-w-xl mx-auto"><div className="card p-6 text-center text-muted text-sm">Sizda zayavka yaratish ruxsati yo&apos;q.</div></div>;
  }

  return (
    <NewRequestForm
      branches={branches ?? []}
      canMaintenance={canMaintenance}
      canNewBranch={canNewBranch}
      employeeName={profile.full_name}
      orgName={org?.name ?? "AXO-OPEN GROUP"}
      role={profile.role}
    />
  );
}
