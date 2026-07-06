import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import NewRequestForm from "./NewRequestForm";

export default async function NewRequestPage() {
  const profile = await requireProfile();
  const sb = await createClient();

  const [{ data: branches }, { data: perms }] = await Promise.all([
    sb.from("branches").select("id, name, status").order("name"),
    sb.from("role_perms").select("perm, allowed").eq("role", profile.role),
  ]);

  const permMap = new Map((perms ?? []).map((p) => [p.perm, p.allowed]));
  const canMaintenance = permMap.get("create_maintenance") ?? false;
  const canNewBranch = permMap.get("create_new_branch") ?? false;

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">Yangi zayavka</h1>
      {!canMaintenance && !canNewBranch ? (
        <div className="card p-6 text-center text-muted text-sm">
          Sizda zayavka yaratish ruxsati yo'q.
        </div>
      ) : (
        <NewRequestForm
          branches={branches ?? []}
          canMaintenance={canMaintenance}
          canNewBranch={canNewBranch}
        />
      )}
    </div>
  );
}
