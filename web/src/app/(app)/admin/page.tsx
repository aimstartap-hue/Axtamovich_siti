import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLES, PERMS, ADMIN_ROLES, type Role } from "@/lib/constants";
import {
  addBranch, setBranchStatus, deleteBranch, deleteUser, saveSettings, togglePerm,
} from "./actions";
import InviteUser from "./InviteUser";

export default async function AdminPage() {
  const profile = await requireProfile();
  if (!ADMIN_ROLES.includes(profile.role)) {
    return <div className="card p-6 text-center text-muted">Bu bo'lim faqat administrator uchun.</div>;
  }
  const sb = await createClient();
  const [{ data: branches }, { data: users }, { data: settings }, { data: perms }] = await Promise.all([
    sb.from("branches").select("*").order("name"),
    sb.from("profiles").select("id, full_name, role, branch_id").order("full_name"),
    sb.from("org_settings").select("*"),
    sb.from("role_perms").select("*"),
  ]);

  const setMap = new Map((settings ?? []).map((s) => [s.key, s.value]));
  const permMap = new Map((perms ?? []).map((p) => [`${p.role}:${p.perm}`, p.allowed]));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Sozlamalar (admin)</h1>

      {/* SOZLAMALAR */}
      <section className="card p-5">
        <h2 className="font-semibold mb-3">Umumiy sozlamalar</h2>
        <form action={saveSettings} className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="label">CEO tasdig'i chegarasi (so'm)</label>
            <input name="ceo_threshold" type="number" className="input"
              defaultValue={setMap.get("ceo_threshold") ?? "50000000"} />
          </div>
          <div>
            <label className="label">AXO ochiq ochchot chegarasi</label>
            <input name="axo_open_limit" type="number" className="input"
              defaultValue={setMap.get("axo_open_limit") ?? "5"} />
          </div>
          <button className="btn btn-brand md:col-span-2">Saqlash</button>
        </form>
      </section>

      {/* FOYDALANUVCHILAR */}
      <section className="card p-5">
        <h2 className="font-semibold mb-3">Xodimlar</h2>
        <InviteUser branches={branches ?? []} />
        <div className="space-y-2 mt-4">
          {(users ?? []).map((u) => (
            <div key={u.id} className="flex items-center gap-3 py-2 border-t border-border">
              <div className="flex-1">
                <div className="font-medium">{u.full_name}</div>
                <div className="text-xs text-muted">{ROLES[u.role as Role] ?? u.role}</div>
              </div>
              {u.id !== profile.id && (
                <form action={deleteUser}>
                  <input type="hidden" name="id" value={u.id} />
                  <button className="btn btn-ghost !px-2 text-danger text-sm">🗑</button>
                </form>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* FILIALLAR */}
      <section className="card p-5">
        <h2 className="font-semibold mb-3">Filiallar</h2>
        <form action={addBranch} className="flex flex-wrap gap-2 mb-3">
          <input name="name" className="input flex-1 min-w-40" placeholder="Filial nomi" required />
          <select name="status" className="select w-40">
            <option value="active">Faol</option>
            <option value="construction">Qurilishda</option>
          </select>
          <button className="btn btn-brand">Qo'shish</button>
        </form>
        <div className="space-y-2">
          {(branches ?? []).map((b) => (
            <div key={b.id} className="flex items-center gap-3 py-2 border-t border-border">
              <div className="flex-1">
                <div className="font-medium">{b.name}</div>
                <div className="text-xs text-muted">{b.status === "construction" ? "Qurilishda" : "Faol"}</div>
              </div>
              <form action={setBranchStatus}>
                <input type="hidden" name="id" value={b.id} />
                <input type="hidden" name="status" value={b.status === "active" ? "construction" : "active"} />
                <button className="btn btn-ghost !py-1 text-xs">{b.status === "active" ? "Qurilishga" : "Faollashtirish"}</button>
              </form>
              <form action={deleteBranch}>
                <input type="hidden" name="id" value={b.id} />
                <button className="btn btn-ghost !px-2 text-danger text-sm">🗑</button>
              </form>
            </div>
          ))}
        </div>
      </section>

      {/* RUXSATLAR */}
      <section className="card p-5 overflow-x-auto">
        <h2 className="font-semibold mb-3">Ruxsatlar (rol qobiliyatlari)</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-1 pr-2">Rol</th>
              {Object.entries(PERMS).map(([k, v]) => <th key={k} className="px-2 text-center">{v}</th>)}
            </tr>
          </thead>
          <tbody>
            {Object.entries(ROLES).map(([role, label]) => (
              <tr key={role} className="border-t border-border">
                <td className="py-1 pr-2 font-medium">{label}</td>
                {Object.keys(PERMS).map((perm) => {
                  const allowed = permMap.get(`${role}:${perm}`) ?? false;
                  return (
                    <td key={perm} className="px-2 text-center">
                      <form action={togglePerm} className="inline">
                        <input type="hidden" name="role" value={role} />
                        <input type="hidden" name="perm" value={perm} />
                        <input type="hidden" name="allowed" value={allowed ? "0" : "1"} />
                        <button className={`w-6 h-6 rounded ${allowed ? "bg-success text-white" : "bg-surface-2 text-muted"}`}>
                          {allowed ? "✓" : "○"}
                        </button>
                      </form>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
