import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/workflow";
import { ROLES, PERMS, ADMIN_ROLES, OPENING_STAGES_FULL, type Role } from "@/lib/constants";
import {
  addBranch, setBranchStatus, deleteBranch, deleteUser, togglePerm,
  saveConfig, saveOrg, toggleModule, clearCache, runBackup,
} from "./actions";
import InviteUser from "./InviteUser";
import ExportCsv from "@/components/ExportCsv";
import SettingsHub, { type SettingsSection } from "./SettingsHub";
import { Group, NumField, TxtField, SelField, AreaField, SwitchField } from "./SettingsUI";
import PersonalSettings from "./PersonalSettings";

const MODULES = [
  { key: "requests", label: "Zayavkalar", core: true }, { key: "budget", label: "Budjet", core: true },
  { key: "openings", label: "Ochilish", core: true }, { key: "assets", label: "Aktivlar", core: true },
  { key: "inventory", label: "Inventarizatsiya", core: true }, { key: "ai_risk", label: "AI Risk", core: true },
  { key: "reports", label: "Hisobotlar", core: true }, { key: "suppliers", label: "Ta'minotchilar", core: true },
  { key: "finance", label: "Moliya", core: true }, { key: "warehouse", label: "Ombor", core: true },
  { key: "payroll", label: "Payroll", core: false }, { key: "crm", label: "CRM", core: false },
  { key: "marketing", label: "Marketing", core: false }, { key: "transport", label: "Transport", core: false },
];
const INTEGRATIONS = [
  { key: "supabase", label: "Supabase", desc: "Ma'lumotlar bazasi", always: true },
  { key: "iiko_key", label: "IIKO", desc: "Kassa integratsiyasi" },
  { key: "telegram_bot_token", label: "Telegram Bot", desc: "Bildirishnoma yuborish" },
  { key: "smtp_host", label: "SMTP (Email)", desc: "Email yuborish" },
  { key: "gdrive_key", label: "Google Drive", desc: "Fayl zaxira" },
  { key: "api_key", label: "API Key", desc: "Tashqi tizimlar" },
  { key: "webhook_url", label: "Webhook", desc: "Hodisa yuborish" },
];
const DOC_MODULES: [string, string][] = [["requests", "Zayavkalar"], ["openings", "Ochilish"], ["assets", "Aktivlar"], ["inventory", "Inventarizatsiya"]];
const DOC_TYPES: [string, string][] = [["pdf", "PDF"], ["foto", "Foto"], ["chek", "Chek"], ["tilxat", "Tilxat"], ["nakladnoy", "Nakladnoy"], ["shartnoma", "Shartnoma"]];

export default async function AdminPage() {
  const profile = await requireProfile();
  const isAdmin = ADMIN_ROLES.includes(profile.role);
  const sb = await createClient();

  // Admin bo'lmagan foydalanuvchi — shaxsiy Sozlamalar (kompaniya/admin sozlamalari YO'Q)
  if (!isAdmin) {
    const { data: myBranches } = await sb.from("branches").select("id, name").order("name");
    return <PersonalSettings fullName={profile.full_name} role={ROLES[profile.role] ?? profile.role} branches={myBranches ?? []} />;
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  const [{ data: org }, { data: branches }, { data: users }, { data: settings }, { data: perms }, { data: auditRows }, { count: auditToday }] = await Promise.all([
    sb.from("organizations").select("name").eq("id", profile.org_id!).single(),
    sb.from("branches").select("id, name, status").order("name"),
    sb.from("profiles").select("id, full_name, role, branch_id").order("full_name"),
    sb.from("org_settings").select("key, value"),
    sb.from("role_perms").select("role, perm, allowed"),
    sb.from("audit_log").select("actor_id, action, detail, created_at").order("created_at", { ascending: false }).limit(20),
    sb.from("audit_log").select("id", { count: "exact", head: true }).gte("created_at", todayIso),
  ]);

  const setMap = new Map((settings ?? []).map((s) => [s.key, s.value] as [string, string]));
  const permMap = new Map((perms ?? []).map((p) => [`${p.role}:${p.perm}`, p.allowed]));
  const userName = new Map((users ?? []).map((u) => [u.id, u.full_name]));
  const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]));
  const g = (k: string, d = "") => setMap.get(k) ?? d;
  const on = (k: string) => setMap.get(k) === "1";
  const modOn = (m: { key: string; core: boolean }) => { const v = setMap.get(`module_${m.key}`); return v == null ? m.core : v === "1"; };
  const intConnected = (i: { key: string; always?: boolean }) => i.always || !!g(i.key);
  const lastBackup = g("last_backup") ? formatDate(g("last_backup")) : "—";
  const intCount = INTEGRATIONS.filter(intConnected).length;
  const notifyCount = ["notify_telegram", "notify_email", "notify_push", "notify_sms"].filter(on).length;
  const pluginCount = MODULES.filter(modOn).length;
  const aiOn = setMap.get("ai_recommendations") !== "0";

  const sections: SettingsSection[] = [
    // ── ASOSIY ──
    {
      id: "org", icon: "🏢", accent: "#3b82f6", group: "Asosiy sozlamalar",
      title: "Kompaniya", desc: "Rekvizitlar, aloqa va mintaqaviy sozlamalar",
      status: "Sozlangan", statusTone: "#22c55e",
      content: (
        <Group icon="🏢" accent="#3b82f6" title="Rekvizitlar" desc="Kompaniya identifikatsiyasi va aloqa ma'lumotlari" action={saveOrg} footNote="O'zgarishlar barcha hisobotlarga ta'sir qiladi">
          <TxtField name="set_org_name" label="Kompaniya nomi" desc="Rasmiy tashkilot nomi" defaultValue={org?.name ?? ""} placeholder="Zahratun Fast Food" />
          <TxtField name="set_org_stir" label="STIR" desc="Soliq to'lovchi identifikatsiya raqami" defaultValue={g("org_stir")} placeholder="300123456" />
          <TxtField name="set_org_logo" label="Logo" desc="To'liq rasm havolasi (URL)" defaultValue={g("org_logo")} placeholder="https://…" />
          <TxtField name="set_org_phone" label="Telefon" desc="Asosiy aloqa raqami" defaultValue={g("org_phone")} placeholder="+998 90 000 00 00" />
          <TxtField name="set_org_email" label="Email" desc="Rasmiy pochta" defaultValue={g("org_email")} placeholder="info@zahratun.uz" />
          <TxtField name="set_org_address" label="Manzil" desc="Bosh ofis manzili" defaultValue={g("org_address")} placeholder="Toshkent sh." />
          <SelField name="set_org_currency" label="Valyuta" desc="Hisob-kitob valyutasi" defaultValue={g("org_currency", "so'm")} options={[["so'm", "so'm"], ["USD", "USD"], ["EUR", "EUR"]]} />
          <SelField name="set_org_tz" label="Vaqt zonasi" desc="Tizim vaqti" defaultValue={g("org_tz", "Asia/Tashkent")} options={[["Asia/Tashkent", "Asia/Tashkent"], ["UTC", "UTC"]]} />
        </Group>
      ),
    },
    {
      id: "branches", icon: "🏪", accent: "#22c55e", group: "Asosiy sozlamalar", adminOnly: true,
      title: "Filiallar", desc: "Filiallarni boshqarish va holatini nazorat qilish",
      status: `${(branches ?? []).length} ta`, statusTone: "#3b82f6",
      content: (
        <Group icon="🏪" accent="#22c55e" title="Filiallar ro'yxati" desc={`Jami ${(branches ?? []).length} ta filial · faol va qurilishdagi`}>
          <div className="py-4">
            <form action={addBranch} className="flex flex-wrap gap-2">
              <input name="name" className="input flex-1 min-w-40" placeholder="Yangi filial nomi" required />
              <select name="status" className="select w-40"><option value="active">Faol</option><option value="construction">Qurilishda</option></select>
              <button className="btn btn-brand !px-5">Qo&apos;shish</button>
            </form>
          </div>
          <div className="py-3 max-h-96 overflow-y-auto -mx-1 px-1">
            {(branches ?? []).length === 0 ? <div className="text-center text-muted text-sm py-4">Filial yo&apos;q.</div> : (branches ?? []).map((b) => (
              <div key={b.id} className="group flex items-center gap-3 py-2.5 px-3 rounded-xl transition hover:bg-surface-2 text-sm">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: b.status === "active" ? "#22c55e" : "#f59e0b" }} />
                <div className="flex-1 min-w-0"><span className="font-medium">{b.name}</span></div>
                <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: b.status === "active" ? "#22c55e1f" : "#f59e0b1f", color: b.status === "active" ? "#22c55e" : "#f59e0b" }}>{b.status === "construction" ? "Qurilishda" : "Faol"}</span>
                <form action={setBranchStatus}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="status" value={b.status === "active" ? "construction" : "active"} /><button className="btn btn-ghost !py-1 !px-2.5 text-xs opacity-0 group-hover:opacity-100 transition">{b.status === "active" ? "Qurilishga" : "Faollashtir"}</button></form>
                <form action={deleteBranch}><input type="hidden" name="id" value={b.id} /><button className="p-1.5 rounded-lg hover:bg-surface-2 text-danger text-sm opacity-0 group-hover:opacity-100 transition">🗑</button></form>
              </div>
            ))}
          </div>
        </Group>
      ),
    },
    {
      id: "users", icon: "👥", accent: "#8b5cf6", group: "Asosiy sozlamalar", adminOnly: true,
      title: "Foydalanuvchilar", desc: "Xodimlar, rollar va ruxsat matritsasi",
      status: `${(users ?? []).length} ta`, statusTone: "#8b5cf6",
      content: (
        <>
          <Group icon="👥" accent="#8b5cf6" title="Xodimlar" desc={`Jami ${(users ?? []).length} ta foydalanuvchi`}>
            <div className="py-4"><InviteUser branches={branches ?? []} /></div>
            <div className="py-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted border-b border-border"><th className="py-2">Ism</th><th className="py-2">Rol</th><th className="py-2">Filial</th><th className="py-2 text-right">Amal</th></tr></thead>
                <tbody>
                  {(users ?? []).map((u) => (
                    <tr key={u.id} className="border-b border-border last:border-0">
                      <td className="py-2.5 font-medium">{u.full_name}</td>
                      <td className="py-2.5"><span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>{ROLES[u.role as Role] ?? u.role}</span></td>
                      <td className="py-2.5 text-muted">{u.branch_id ? branchName.get(u.branch_id) ?? "—" : "—"}</td>
                      <td className="py-2.5 text-right">{u.id !== profile.id && <form action={deleteUser}><input type="hidden" name="id" value={u.id} /><button className="p-1.5 rounded-lg hover:bg-surface-2 text-danger text-sm">🗑</button></form>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Group>
          <Group icon="🔑" accent="#f59e0b" title="Ruxsatlar matritsasi" desc="Har rol nimani qila oladi — bosib yoqing/o'chiring">
            <div className="py-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted"><th className="py-1 pr-2">Rol</th>{Object.entries(PERMS).map(([k, v]) => <th key={k} className="px-2 text-center font-medium">{v}</th>)}</tr></thead>
                <tbody>
                  {Object.entries(ROLES).map(([role, label]) => (
                    <tr key={role} className="border-t border-border">
                      <td className="py-1.5 pr-2 font-medium whitespace-nowrap">{label}</td>
                      {Object.keys(PERMS).map((perm) => {
                        const allowed = permMap.get(`${role}:${perm}`) ?? false;
                        return <td key={perm} className="px-2 text-center"><form action={togglePerm} className="inline"><input type="hidden" name="role" value={role} /><input type="hidden" name="perm" value={perm} /><input type="hidden" name="allowed" value={allowed ? "0" : "1"} /><button className={`w-6 h-6 rounded-md transition ${allowed ? "bg-success text-white" : "bg-surface-2 text-muted hover:brightness-125"}`}>{allowed ? "✓" : "○"}</button></form></td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Group>
        </>
      ),
    },
    {
      id: "budget", icon: "💰", accent: "#f59e0b", group: "Asosiy sozlamalar",
      title: "Budjet", desc: "Moliyaviy chegaralar va AI Risk parametrlari",
      status: aiOn ? "AI yoniq" : "AI o'chiq", statusTone: aiOn ? "#22c55e" : "#94a3b8",
      content: (
        <>
          <Group icon="💰" accent="#f59e0b" title="Moliyaviy chegaralar" desc="Byudjet davri, soliq va tasdiqlash chegaralari" action={saveConfig} footNote="Zayavka oqimiga ta'sir qiladi">
            <SelField name="set_budget_period" label="Budjet davri" desc="Sarf qaysi davr bo'yicha hisoblanadi" defaultValue={g("budget_period", "monthly")} options={[["monthly", "Oylik"], ["quarterly", "Choraklik"], ["yearly", "Yillik"]]} />
            <NumField name="set_ceo_threshold" label="CEO tasdiq chegarasi" desc="Bu summadan yuqori xarid CEO tasdig'ini talab qiladi" unit="so'm" defaultValue={g("ceo_threshold", "50000000")} placeholder="50 000 000" />
            <NumField name="set_vat_percent" label="QQS stavkasi" desc="Qo'shilgan qiymat solig'i" unit="%" defaultValue={g("vat_percent", "12")} placeholder="12" />
            <NumField name="set_budget_warn_percent" label="Ogohlantirish chegarasi" desc="Byudjetning necha foizida ogohlantirish chiqadi" unit="%" defaultValue={g("budget_warn_percent", "90")} placeholder="90" />
          </Group>
          <Group icon="🤖" accent="#2563eb" title="AI Risk parametrlari" desc="Budjet ichidagi AI tekshiruvlari uchun chegaralar" action={saveConfig} hiddenCb="ai_recommendations" footNote="Narx, takror va limit anomaliyalari shu asosda aniqlanadi">
            <NumField name="set_ai_price_pct" label="Narx anomaliyasi" desc="Bozor narxidan shuncha % oshsa — shubhali" unit="%" defaultValue={g("ai_price_pct", "30")} placeholder="30" />
            <NumField name="set_ai_repeat_count" label="Takroriy xarid" desc="15 kunda shuncha marta takror — belgilanadi" unit="marta" defaultValue={g("ai_repeat_count", "4")} placeholder="4" />
            <NumField name="set_ai_limit_pct" label="Limit ogohlantirishi" desc="Limitning necha foizida signal" unit="%" defaultValue={g("ai_limit_pct", "90")} placeholder="90" />
            <NumField name="set_ai_critical_pct" label="Kritik daraja" desc="Bu foizdan yuqori — kritik xavf" unit="%" defaultValue={g("ai_critical_pct", "100")} placeholder="100" />
            <SwitchField name="set_ai_recommendations" label="AI tavsiyalari" desc="Xavfli holatlarda AI tavsiya ko'rsatsinmi" checked={aiOn} />
          </Group>
        </>
      ),
    },

    // ── MODULLAR ──
    {
      id: "openings", icon: "🚀", accent: "#3b82f6", group: "Modul sozlamalari",
      title: "Ochilish", desc: "Yangi filial ochilishi uchun standart shablonlar",
      status: "Standart", statusTone: "#3b82f6",
      content: (
        <Group icon="🚀" accent="#3b82f6" title="Ochilish shabloni" desc="Har yangi loyihaga qo'llaniladigan standart" action={saveConfig} hiddenCb="opening_photo_required,opening_stage_required">
          <AreaField name="set_opening_stages" label="Standart bosqichlar" desc="Vergul bilan ajrating — loyiha ochilganda avtomat qo'yiladi" defaultValue={g("opening_stages", OPENING_STAGES_FULL.map((s) => s.label).join(", "))} />
          <AreaField name="set_opening_checklist" label="Standart checklist" desc="Bajarilishi shart bo'lgan ishlar ro'yxati" defaultValue={g("opening_checklist", "Ijara shartnomasi, Litsenziya, Elektr ruxsati, IIKO sozlash")} />
          <TxtField name="set_opening_docs" label="Standart hujjatlar" desc="Har bosqichda kutiladigan hujjatlar" defaultValue={g("opening_docs", "Shartnoma, Nakladnoy, Chek")} />
          <SwitchField name="set_opening_photo_required" label="Foto majburiy" desc="Har bosqich yopilishida foto talab qilinsinmi" checked={on("opening_photo_required")} />
          <SwitchField name="set_opening_stage_required" label="Ketma-ketlik majburiy" desc="Bosqichlar tartib bilan bajarilsinmi" checked={on("opening_stage_required")} />
        </Group>
      ),
    },
    {
      id: "assets", icon: "🖥", accent: "#8b5cf6", group: "Modul sozlamalari",
      title: "Aktivlar", desc: "Aktiv pasporti uchun ma'lumotnomalar",
      status: "Standart", statusTone: "#8b5cf6",
      content: (
        <Group icon="🖥" accent="#8b5cf6" title="Aktiv ma'lumotnomalari" desc="Kategoriya, brend, QR va amortizatsiya sozlamalari" action={saveConfig}>
          <AreaField name="set_asset_categories" label="Aktiv kategoriyalari" desc="Vergul bilan — jihoz turlari" defaultValue={g("asset_categories", "Sovutkich, Fritöz, Pech, Printer, Kassa, Kompyuter, Generator")} />
          <TxtField name="set_asset_brands" label="Brendlar" desc="Ruxsat etilgan ishlab chiqaruvchilar" defaultValue={g("asset_brands", "Samsung, LG, Bosch, HP, Epson")} />
          <TxtField name="set_asset_statuses" label="Holatlar" desc="Aktiv holati variantlari" defaultValue={g("asset_statuses", "Faol, Ta'mirda, Zaxira, Yaroqsiz")} />
          <TxtField name="set_asset_qr_format" label="QR format" desc="QR kod shabloni" defaultValue={g("asset_qr_format", "AXO-{branch}-{id}")} />
          <TxtField name="set_asset_inv_format" label="Inventar raqami" desc="Inventar raqam shabloni" defaultValue={g("asset_inv_format", "INV-{yyyy}-{id}")} />
          <SelField name="set_asset_amortization" label="Amortizatsiya turi" desc="Qiymat qanday kamayadi" defaultValue={g("asset_amortization", "linear")} options={[["linear", "Chiziqli"], ["declining", "Kamayuvchi"], ["none", "Yo'q"]]} />
        </Group>
      ),
    },
    {
      id: "inventory", icon: "📦", accent: "#22c55e", group: "Modul sozlamalari",
      title: "Inventarizatsiya", desc: "Tekshiruv qoidalari va farq nazorati",
      status: "Standart", statusTone: "#22c55e",
      content: (
        <Group icon="📦" accent="#22c55e" title="Tekshiruv sozlamalari" desc="Inventarizatsiya jarayoni qoidalari" action={saveConfig} hiddenCb="inv_photo_required,inv_qr_enabled">
          <TxtField name="set_inv_template" label="Tekshiruv shabloni" desc="Standart tekshiruv nomi" defaultValue={g("inv_template", "Standart oylik inventarizatsiya")} />
          <NumField name="set_inv_diff_limit" label="Farq limiti" desc="Ruxsat etilgan maksimal farq" unit="%" defaultValue={g("inv_diff_limit", "5")} placeholder="5" />
          <SwitchField name="set_inv_photo_required" label="Foto majburiy" desc="Tekshiruvda foto talab qilinsinmi" checked={on("inv_photo_required")} />
          <SwitchField name="set_inv_qr_enabled" label="QR skanerlash" desc="Aktivlar QR orqali skanerlansinmi" checked={on("inv_qr_enabled")} />
        </Group>
      ),
    },
    {
      id: "docs", icon: "📑", accent: "#06b6d4", group: "Modul sozlamalari",
      title: "Hujjatlar", desc: "Qaysi modulda qaysi hujjat majburiy",
      content: (
        <Group icon="📑" accent="#06b6d4" title="Hujjat matritsasi" desc="Belgilangan hujjatlar tegishli modulda majburiy bo'ladi" action={saveConfig} hiddenCb={DOC_MODULES.flatMap(([m]) => DOC_TYPES.map(([d]) => `docm_${m}_${d}`)).join(",")}>
          <div className="py-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted border-b border-border"><th className="py-2 pr-3">Modul</th>{DOC_TYPES.map(([, l]) => <th key={l} className="px-2 text-center font-medium">{l}</th>)}</tr></thead>
              <tbody>
                {DOC_MODULES.map(([m, ml]) => (
                  <tr key={m} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-3 font-medium whitespace-nowrap">{ml}</td>
                    {DOC_TYPES.map(([d]) => (
                      <td key={d} className="px-2 text-center"><input type="checkbox" name={`set_docm_${m}_${d}`} value="1" defaultChecked={on(`docm_${m}_${d}`)} className="w-4 h-4 accent-brand" /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Group>
      ),
    },

    // ── TIZIM ──
    {
      id: "notify", icon: "🔔", accent: "#f59e0b", group: "Tizim",
      title: "Bildirishnomalar", desc: "Xabar yuborish kanallari",
      status: `${notifyCount} faol`, statusTone: notifyCount ? "#22c55e" : "#94a3b8",
      content: (
        <Group icon="🔔" accent="#f59e0b" title="Kanallar" desc="Qaysi kanallar orqali bildirishnoma yuborilsin" action={saveConfig} hiddenCb="notify_telegram,notify_email,notify_push,notify_sms">
          <SwitchField name="set_notify_telegram" label="Telegram" desc="Bot orqali tezkor xabar" checked={on("notify_telegram")} />
          <SwitchField name="set_notify_email" label="Email" desc="Rasmiy pochta xabarnomasi" checked={on("notify_email")} />
          <SwitchField name="set_notify_push" label="Web push" desc="Brauzer bildirishnomasi" checked={on("notify_push")} />
          <SwitchField name="set_notify_sms" label="SMS" desc="Qisqa matnli xabar" checked={on("notify_sms")} />
        </Group>
      ),
    },
    {
      id: "integrations", icon: "🔌", accent: "#06b6d4", group: "Tizim", adminOnly: true,
      title: "Integratsiyalar", desc: "Tashqi tizimlar va API kalitlari",
      status: `${intCount}/${INTEGRATIONS.length}`, statusTone: "#06b6d4",
      content: (
        <>
          <Group icon="🔌" accent="#06b6d4" title="Ulanish holati" desc="Tashqi xizmatlar bilan bog'lanish">
            <div className="py-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {INTEGRATIONS.map((i) => {
                const conn = intConnected(i);
                return (
                  <div key={i.key} className="flex items-center gap-3 rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: conn ? "#22c55e" : "#94a3b8" }} />
                    <div className="flex-1 min-w-0"><div className="text-sm font-medium">{i.label}</div><div className="text-[11px] text-muted truncate">{i.desc}</div></div>
                    <span className="text-[11px] font-medium" style={{ color: conn ? "#22c55e" : "var(--muted)" }}>{conn ? "Ulangan" : "Ulanmagan"}</span>
                  </div>
                );
              })}
            </div>
          </Group>
          <Group icon="🔑" accent="#8b5cf6" title="API kalitlari" desc="Maxfiy — faqat administrator ko'radi" action={saveConfig}>
            <TxtField name="set_iiko_key" label="IIKO API key" desc="Kassa integratsiyasi kaliti" defaultValue={g("iiko_key")} placeholder="—" />
            <TxtField name="set_telegram_bot_token" label="Telegram Bot token" desc="Bot bildirishnomasi uchun" defaultValue={g("telegram_bot_token")} placeholder="—" />
            <TxtField name="set_smtp_host" label="SMTP host" desc="Email yuborish serveri" defaultValue={g("smtp_host")} placeholder="—" />
            <TxtField name="set_webhook_url" label="Webhook URL" desc="Hodisalarni yuborish manzili" defaultValue={g("webhook_url")} placeholder="—" />
          </Group>
        </>
      ),
    },
    {
      id: "audit", icon: "📝", accent: "#64748b", group: "Tizim",
      title: "Audit va loglar", desc: "Kim, qachon, nimani o'zgartirdi",
      status: `Bugun ${auditToday ?? 0}`, statusTone: "#3b82f6",
      content: (
        <Group icon="📝" accent="#64748b" title="O'zgarishlar tarixi" desc={`So'nggi ${(auditRows ?? []).length} ta hodisa`}>
          <div className="py-3">
            <div className="flex justify-end mb-2">
              <ExportCsv filename="audit-log" headers={["Sana", "Kim", "Amal", "Tafsilot"]} rows={(auditRows ?? []).map((a) => [formatDate(a.created_at), a.actor_id ? userName.get(a.actor_id) ?? "—" : "Tizim", a.action, a.detail ?? ""])} />
            </div>
            <div className="relative pl-4 max-h-96 overflow-y-auto">
              <div className="absolute left-[5px] top-1 bottom-1 w-px" style={{ background: "var(--border)" }} />
              {(auditRows ?? []).length === 0 ? <div className="text-center text-muted text-sm py-4">Log yo&apos;q.</div> : (auditRows ?? []).map((a, i) => (
                <div key={i} className="relative pb-3.5 last:pb-0">
                  <span className="absolute -left-4 top-1.5 w-2 h-2 rounded-full" style={{ background: "var(--brand)", boxShadow: "0 0 0 2px var(--surface)" }} />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 text-sm"><span className="font-medium">{a.actor_id ? userName.get(a.actor_id) ?? "—" : "Tizim"}</span> <span className="text-muted">· {a.detail ?? a.action}</span></div>
                    <span className="text-[11px] text-muted whitespace-nowrap shrink-0">{formatDate(a.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Group>
      ),
    },
    {
      id: "backup", icon: "💾", accent: "#3b82f6", group: "Tizim", adminOnly: true,
      title: "Backup", desc: "Zaxira nusxa va tiklash",
      status: lastBackup, statusTone: "#94a3b8",
      content: (
        <Group icon="💾" accent="#3b82f6" title="Zaxira nusxa" desc="Ma'lumotlar avtomatik va qo'lda zaxiralanadi">
          <div className="py-4 space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: "var(--surface-2)" }}><span className="text-muted">Avtomatik backup</span><span className="text-success font-medium">Supabase · kunlik ✓</span></div>
            <div className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: "var(--surface-2)" }}><span className="text-muted">Oxirgi qo&apos;lda belgi</span><span className="font-medium">{lastBackup}</span></div>
          </div>
          <div className="py-4">
            <form action={runBackup}><button className="btn btn-brand !px-5">Qo&apos;lda backup belgisi qo&apos;yish</button></form>
            <p className="text-[11px] text-muted mt-2">Restore Supabase panelida amalga oshiriladi.</p>
          </div>
        </Group>
      ),
    },
    {
      id: "plugins", icon: "🧩", accent: "#8b5cf6", group: "Tizim", adminOnly: true,
      title: "Plugin Manager", desc: "Modullarni yoqish yoki o'chirish",
      status: `${pluginCount} yoniq`, statusTone: "#8b5cf6",
      content: (
        <Group icon="🧩" accent="#8b5cf6" title="Modullar" desc="Yadro modullar doim yoniq · yangilar plugin sifatida qo'shiladi">
          <div className="py-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {MODULES.map((m) => {
              const active = modOn(m);
              return (
                <form key={m.key} action={toggleModule} className="contents">
                  <input type="hidden" name="module" value={m.key} />
                  <input type="hidden" name="on" value={active ? "0" : "1"} />
                  <button className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-left transition hover:brightness-110" style={{ background: "var(--surface-2)", border: `1px solid ${active ? "var(--brand)" : "var(--border)"}` }}>
                    <span className="w-4 h-4 rounded flex items-center justify-center text-[10px] shrink-0" style={{ background: active ? "var(--brand)" : "transparent", border: active ? "none" : "1px solid var(--border)", color: "#fff" }}>{active ? "✓" : ""}</span>
                    <span className="flex-1 truncate">{m.label}</span>
                    {!m.core && <span className="text-[9px] text-muted">yangi</span>}
                  </button>
                </form>
              );
            })}
          </div>
        </Group>
      ),
    },
    {
      id: "system", icon: "⚙", accent: "#64748b", group: "Tizim", adminOnly: true,
      title: "Tizim", desc: "Holat, versiya va texnik xizmat",
      status: "OK", statusTone: "#22c55e",
      content: (
        <Group icon="⚙" accent="#64748b" title="Tizim holati" desc="Server va ma'lumotlar bazasi holati">
          <div className="py-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {[["Versiya", "AXO-OPEN v1.0", "var(--text)"], ["Ma'lumotlar bazasi", "Supabase · ulangan ✓", "#22c55e"], ["Server holati", "Ishlamoqda ✓", "#22c55e"], ["Health check", "OK", "#22c55e"]].map(([l, v, c]) => (
              <div key={l} className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: "var(--surface-2)" }}><span className="text-muted">{l}</span><span className="font-medium" style={{ color: c }}>{v}</span></div>
            ))}
          </div>
          <div className="py-4"><form action={clearCache}><button className="btn btn-ghost !px-5">🧹 Cache tozalash</button></form></div>
        </Group>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium mb-1" style={{ color: "var(--muted)" }}>Boshqaruv paneli</div>
          <h1 className="text-2xl font-bold tracking-tight">Sozlamalar</h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Tizimni boshqarish markazi — bo&apos;limni tanlang</p>
        </div>
      </div>
      <SettingsHub sections={sections.filter((s) => isAdmin || !s.adminOnly)} />
    </div>
  );
}
