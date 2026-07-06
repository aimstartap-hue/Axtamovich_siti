import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/workflow";

async function addAsset(formData: FormData) {
  "use server";
  const profile = await requireProfile();
  const sb = await createClient();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await sb.from("assets").insert({
    org_id: profile.org_id, name,
    category: String(formData.get("category") || "") || null,
    branch_id: formData.get("branch_id") ? Number(formData.get("branch_id")) : null,
    serial: String(formData.get("serial") || "") || null,
    purchase_date: String(formData.get("purchase_date") || "") || null,
    warranty_until: String(formData.get("warranty_until") || "") || null,
  });
  revalidatePath("/assets");
}

async function deleteAsset(formData: FormData) {
  "use server";
  await requireProfile();
  const sb = await createClient();
  await sb.from("assets").delete().eq("id", Number(formData.get("id")));
  revalidatePath("/assets");
}

export default async function AssetsPage() {
  await requireProfile();
  const sb = await createClient();
  const [{ data: assets }, { data: branches }] = await Promise.all([
    sb.from("assets").select("*, branch:branches(name)").order("id", { ascending: false }),
    sb.from("branches").select("id, name").order("name"),
  ]);

  const soon = (d: string | null) => {
    if (!d) return false;
    const days = (new Date(d).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 30;
  };
  const expired = (d: string | null) => (d ? new Date(d).getTime() < Date.now() : false);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Aktivlar / Jihozlar</h1>

      <details className="card p-4">
        <summary className="cursor-pointer font-medium">+ Yangi aktiv qo'shish</summary>
        <form action={addAsset} className="grid md:grid-cols-2 gap-3 mt-3">
          <input name="name" className="input" placeholder="Nomi" required />
          <input name="category" className="input" placeholder="Kategoriya" />
          <select name="branch_id" className="select">
            <option value="">— filial —</option>
            {(branches ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <input name="serial" className="input" placeholder="Seriya raqami" />
          <div><label className="label">Sotib olingan</label><input name="purchase_date" type="date" className="input" /></div>
          <div><label className="label">Kafolat tugashi</label><input name="warranty_until" type="date" className="input" /></div>
          <button className="btn btn-brand md:col-span-2">Qo'shish</button>
        </form>
      </details>

      <div className="space-y-2">
        {(assets ?? []).map((a) => (
          <div key={a.id} className="card p-4 flex items-center gap-3">
            <div className="flex-1">
              <div className="font-medium">{a.name}</div>
              <div className="text-xs text-muted">
                {a.category ?? "—"} · {a.branch?.name ?? "Umumiy"}
                {a.serial ? ` · ${a.serial}` : ""}
              </div>
              {a.warranty_until && (
                <div className={`text-xs mt-1 ${expired(a.warranty_until) ? "text-danger" : soon(a.warranty_until) ? "text-warning" : "text-muted"}`}>
                  Kafolat: {formatDate(a.warranty_until)}
                  {expired(a.warranty_until) ? " (tugagan)" : soon(a.warranty_until) ? " (tez tugaydi!)" : ""}
                </div>
              )}
            </div>
            <form action={deleteAsset}>
              <input type="hidden" name="id" value={a.id} />
              <button className="btn btn-ghost !px-3 text-danger">🗑</button>
            </form>
          </div>
        ))}
        {(assets ?? []).length === 0 && <div className="card p-6 text-center text-muted text-sm">Aktiv yo'q.</div>}
      </div>
    </div>
  );
}
