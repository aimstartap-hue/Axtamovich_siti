"use client";

import { useEffect, useState, useCallback } from "react";
import { logoutAction } from "@/app/(auth)/actions";
import SettingsHub, { type SettingsSection } from "./SettingsHub";

// =============================================================================
// Shaxsiy Sozlamalar — Open Group / oddiy foydalanuvchi uchun ish muhiti.
// Kompaniya/admin sozlamalari BU YERDA YO'Q. Backend yo'q — interfeys afzalliklari
// localStorage'da saqlanadi va darhol qo'llanadi (Linear/Vercel uslubi).
// =============================================================================

interface Branch { id: number; name: string; }
type Prefs = Record<string, string | boolean | string[]>;

const KEY = "axo_prefs";
const ACCENTS = ["#2563eb", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

const DEFAULTS: Prefs = {
  accent: "#2563eb", fontSize: "md", compact: false, sidebarOpen: true, sidebarIcon: false,
  density: "normal", view: "table", anim: true, lang: "uz",
  nTelegram: true, nEmail: true, nPush: false, nDesktop: false, nSms: false,
  wKpi: true, wTasks: true, wRecent: true, wActive: true, wCalendar: false, wStats: true,
  defBranch: "", defCat: "", defPriority: "normal", rememberLast: true, autofill: true,
  rowsPerPage: "25", sorting: "newest", dateFmt: "dd.mm.yyyy", curFmt: "space", excelType: "xlsx",
  startPage: "/", favModules: ["requests", "openings", "assets"],
  sReq: true, sAssets: true, sBranches: true, sDocs: true, sStaff: false,
};

export default function PersonalSettings({ fullName, role, branches }: { fullName: string; role: string; branches: Branch[] }) {
  const [p, setP] = useState<Prefs>(DEFAULTS);
  const [theme, setThemeState] = useState<"dark" | "light">("dark");
  const [loaded, setLoaded] = useState(false);

  // Hydrate (SSR mos kelishi uchun — bir martalik localStorage o'qish)
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try { const raw = localStorage.getItem(KEY); if (raw) setP({ ...DEFAULTS, ...JSON.parse(raw) }); } catch {}
    setThemeState(document.documentElement.classList.contains("dark") ? "dark" : "light");
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Qo'llash (accent / font / animatsiya)
  useEffect(() => {
    if (!loaded) return;
    const el = document.documentElement;
    el.style.setProperty("--brand", p.accent as string);
    el.style.fontSize = p.fontSize === "sm" ? "14px" : p.fontSize === "lg" ? "18px" : "16px";
    el.classList.toggle("no-anim", !(p.anim as boolean));
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
  }, [p, loaded]);

  const set = useCallback((k: string, v: string | boolean | string[]) => setP((x) => ({ ...x, [k]: v })), []);
  const setTheme = (t: "dark" | "light") => {
    const el = document.documentElement;
    el.classList.toggle("dark", t === "dark"); el.dataset.theme = t;
    try { localStorage.setItem("theme", t); } catch {}
    setThemeState(t);
  };
  const b = (k: string) => p[k] as boolean;
  const s = (k: string) => p[k] as string;

  const initial = (fullName.trim()[0] || "A").toUpperCase();

  const sections: SettingsSection[] = [
    {
      id: "profile", icon: "👤", accent: "#3b82f6", group: "Hisob", title: "Profil", desc: "Shaxsiy ma'lumotlar va kirish xavfsizligi", status: role, statusTone: "#3b82f6",
      content: (
        <>
          <CGroup icon="👤" accent="#3b82f6" title="Shaxsiy ma'lumotlar" desc="Avatar va aloqa ma'lumotlaringiz">
            <div className="py-4 flex items-center gap-4">
              <span className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shrink-0" style={{ background: "linear-gradient(135deg,#2563eb,#7aa8ff)" }}>{initial}</span>
              <div className="min-w-0"><div className="font-semibold text-lg leading-tight">{fullName}</div><div className="text-sm" style={{ color: "var(--muted)" }}>{role}</div></div>
              <button className="ml-auto btn btn-ghost !px-4 shrink-0">Avatar</button>
            </div>
            <CInput label="Ism" desc="To'liq ism sharifingiz" value={fullName} onChange={() => {}} />
            <CInput label="Telefon" desc="Aloqa raqami" value={s("phone")} placeholder="+998 90 000 00 00" onChange={(v) => set("phone", v)} />
            <CInput label="Email" desc="Elektron pochta" value={s("email")} placeholder="siz@zahratun.uz" onChange={(v) => set("email", v)} />
          </CGroup>
          <CGroup icon="🔐" accent="#8b5cf6" title="Xavfsizlik" desc="Parol, PIN va ikki bosqichli himoya">
            <ActionRow label="Parolni almashtirish" desc="Kirish parolini yangilang" btn="O'zgartirish" soon />
            <ActionRow label="PIN kod" desc="Tez kirish uchun 4 xonali kod" btn="Sozlash" soon />
            <SwRow label="Ikki bosqichli autentifikatsiya (2FA)" desc="Qo'shimcha himoya qatlami" checked={b("twofa")} onChange={(v) => set("twofa", v)} soon />
          </CGroup>
        </>
      ),
    },
    {
      id: "interface", icon: "🎨", accent: "#8b5cf6", group: "Ish muhiti", title: "Interfeys", desc: "Tema, rang, o'lcham va ko'rinish", status: theme === "dark" ? "Dark" : "Light", statusTone: "#8b5cf6",
      content: (
        <>
          <CGroup icon="🎨" accent="#8b5cf6" title="Ko'rinish" desc="Tema va accent rang — darhol qo'llanadi" auto>
            <CRow label="Tema" desc="Yorug' yoki qorong'i rejim"><Segmented value={theme} onChange={(v) => setTheme(v as "dark" | "light")} options={[["dark", "Dark"], ["light", "Light"]]} /></CRow>
            <CRow label="Accent rang" desc="Asosiy urg'u rangi">
              <div className="flex gap-2 flex-wrap sm:justify-end">
                {ACCENTS.map((c) => (
                  <button key={c} onClick={() => set("accent", c)} aria-label={c} className="w-7 h-7 rounded-full transition hover:scale-110" style={{ background: c, outline: s("accent") === c ? "2px solid var(--text)" : "none", outlineOffset: "2px" }} />
                ))}
              </div>
            </CRow>
            <CRow label="Shrift o'lchami" desc="Matn kattaligi"><Segmented value={s("fontSize")} onChange={(v) => set("fontSize", v)} options={[["sm", "S"], ["md", "M"], ["lg", "L"]]} /></CRow>
          </CGroup>
          <CGroup icon="🧩" accent="#06b6d4" title="Tartib" desc="Sidebar, zichlik va animatsiyalar" auto>
            <SwRow label="Compact rejim" desc="Zichroq, ixcham ko'rinish" checked={b("compact")} onChange={(v) => set("compact", v)} />
            <SwRow label="Sidebar doim ochiq" desc="Chap panel yopilmasin" checked={b("sidebarOpen")} onChange={(v) => set("sidebarOpen", v)} />
            <SwRow label="Sidebar faqat ikonka" desc="Panel torroq — faqat belgilar" checked={b("sidebarIcon")} onChange={(v) => set("sidebarIcon", v)} />
            <CRow label="Jadval zichligi" desc="Qatorlar orasidagi masofa"><Segmented value={s("density")} onChange={(v) => set("density", v)} options={[["compact", "Zich"], ["normal", "O'rta"], ["comfort", "Keng"]]} /></CRow>
            <CRow label="Ma'lumot ko'rinishi" desc="Standart ko'rsatish uslubi"><Segmented value={s("view")} onChange={(v) => set("view", v)} options={[["table", "Jadval"], ["card", "Kartochka"]]} /></CRow>
            <SwRow label="Animatsiyalar" desc="Silliq o'tishlar va effektlar" checked={b("anim")} onChange={(v) => set("anim", v)} />
          </CGroup>
        </>
      ),
    },
    {
      id: "lang", icon: "🌐", accent: "#22c55e", group: "Ish muhiti", title: "Til", desc: "Interfeys tili", status: (s("lang") as string).toUpperCase(), statusTone: "#22c55e",
      content: (
        <CGroup icon="🌐" accent="#22c55e" title="Interfeys tili" desc="Dastur qaysi tilda ko'rsatilsin" auto>
          {[["uz", "O'zbek", "🇺🇿"], ["ru", "Русский", "🇷🇺"], ["en", "English", "🇬🇧"]].map(([v, l, f]) => (
            <button key={v} onClick={() => set("lang", v)} className="w-full flex items-center gap-3 py-3.5 text-left transition">
              <span className="text-xl">{f}</span><span className="flex-1 text-sm font-medium">{l}</span>
              <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ border: `2px solid ${s("lang") === v ? "var(--brand)" : "var(--border)"}` }}>{s("lang") === v && <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--brand)" }} />}</span>
            </button>
          ))}
        </CGroup>
      ),
    },
    {
      id: "notify", icon: "🔔", accent: "#f59e0b", group: "Ish muhiti", title: "Bildirishnomalar", desc: "Qaysi kanallardan xabar olasiz",
      content: (
        <CGroup icon="🔔" accent="#f59e0b" title="Kanallar" desc="Har birini alohida yoqing yoki o'chiring" auto>
          <SwRow label="Telegram" desc="Bot orqali tezkor xabar" checked={b("nTelegram")} onChange={(v) => set("nTelegram", v)} />
          <SwRow label="Email" desc="Pochta xabarnomasi" checked={b("nEmail")} onChange={(v) => set("nEmail", v)} />
          <SwRow label="Push" desc="Ilova bildirishnomasi" checked={b("nPush")} onChange={(v) => set("nPush", v)} />
          <SwRow label="Desktop" desc="Kompyuter bildirishnomasi" checked={b("nDesktop")} onChange={(v) => set("nDesktop", v)} />
          <SwRow label="SMS" desc="Qisqa matnli xabar" checked={b("nSms")} onChange={(v) => set("nSms", v)} />
        </CGroup>
      ),
    },
    {
      id: "dashboard", icon: "📊", accent: "#2563eb", group: "Ishni sozlash", title: "Dashboard", desc: "Bosh sahifa vidjetlarini tanlang",
      content: (
        <CGroup icon="📊" accent="#2563eb" title="Vidjetlar" desc="Dashboardda ko'rinadigan bloklarni belgilang" auto footNote="Drag & Drop bilan joyini almashtirish — tez orada">
          <div className="py-3 grid sm:grid-cols-2 gap-2">
            {[["wKpi", "KPI ko'rsatkichlar"], ["wTasks", "Mening vazifalarim"], ["wRecent", "Oxirgi zayavkalar"], ["wActive", "Faol jarayonlar"], ["wCalendar", "Kalendar"], ["wStats", "Statistikalar"]].map(([k, l]) => (
              <button key={k} onClick={() => set(k, !b(k))} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-left transition" style={{ background: "var(--surface-2)", border: `1px solid ${b(k) ? "var(--brand)" : "var(--border)"}` }}>
                <span className="w-4 h-4 rounded flex items-center justify-center text-[10px] shrink-0 text-white" style={{ background: b(k) ? "var(--brand)" : "transparent", border: b(k) ? "none" : "1px solid var(--border)" }}>{b(k) ? "✓" : ""}</span>
                <span className="flex-1">{l}</span>
              </button>
            ))}
          </div>
        </CGroup>
      ),
    },
    {
      id: "requests", icon: "📄", accent: "#06b6d4", group: "Ishni sozlash", title: "Zayavkalar", desc: "Yangi zayavka uchun standart qiymatlar",
      content: (
        <CGroup icon="📄" accent="#06b6d4" title="Standart qiymatlar" desc="Yangi zayavka ochilganda avtomat to'ldiriladi" auto>
          <CSelect label="Default filial" desc="Odatda tanlanadigan filial" value={s("defBranch")} onChange={(v) => set("defBranch", v)} options={[["", "— tanlanmagan —"], ...branches.map((x) => [String(x.id), x.name] as [string, string])]} />
          <CInput label="Default kategoriya" desc="Ko'p ishlatiladigan kategoriya" value={s("defCat")} placeholder="Masalan: Ремонт помещения" onChange={(v) => set("defCat", v)} />
          <CSelect label="Default ustuvorlik" desc="Standart muhimlik darajasi" value={s("defPriority")} onChange={(v) => set("defPriority", v)} options={[["urgent", "Shoshilinch"], ["normal", "Oddiy"], ["low", "Kam muhim"]]} />
          <SwRow label="Oxirgi qiymatni eslab qolish" desc="Avvalgi tanlovni takrorlash" checked={b("rememberLast")} onChange={(v) => set("rememberLast", v)} />
          <SwRow label="Avtomatik to'ldirish" desc="Formani standart qiymatlar bilan to'ldirish" checked={b("autofill")} onChange={(v) => set("autofill", v)} />
        </CGroup>
      ),
    },
    {
      id: "table", icon: "📋", accent: "#8b5cf6", group: "Ishni sozlash", title: "Jadval", desc: "Ro'yxatlar va eksport formati",
      content: (
        <CGroup icon="📋" accent="#8b5cf6" title="Jadval sozlamalari" desc="Ro'yxatlar qanday ko'rsatilsin va eksport qilinsin" auto>
          <CSelect label="Sahifadagi qatorlar" desc="Bir sahifada nechta yozuv" value={s("rowsPerPage")} onChange={(v) => set("rowsPerPage", v)} options={[["10", "10"], ["25", "25"], ["50", "50"], ["100", "100"]]} />
          <CSelect label="Standart tartiblash" desc="Ro'yxat qanday saralanadi" value={s("sorting")} onChange={(v) => set("sorting", v)} options={[["newest", "Avval yangi"], ["oldest", "Avval eski"], ["priority", "Ustuvorlik"]]} />
          <CSelect label="Sana formati" desc="Sanalar ko'rinishi" value={s("dateFmt")} onChange={(v) => set("dateFmt", v)} options={[["dd.mm.yyyy", "dd.mm.yyyy"], ["yyyy-mm-dd", "yyyy-mm-dd"]]} />
          <CSelect label="Valyuta formati" desc="Summalar ko'rinishi" value={s("curFmt")} onChange={(v) => set("curFmt", v)} options={[["space", "1 500 000"], ["comma", "1,500,000"]]} />
          <CSelect label="Excel eksport turi" desc="Fayl formati" value={s("excelType")} onChange={(v) => set("excelType", v)} options={[["xlsx", "XLSX"], ["csv", "CSV"]]} />
        </CGroup>
      ),
    },
    {
      id: "workspace", icon: "⭐", accent: "#f59e0b", group: "Ishni sozlash", title: "Workspace", desc: "Shaxsiy ish maydoni va boshlang'ich sahifa", status: "Premium", statusTone: "#f59e0b",
      content: (
        <CGroup icon="⭐" accent="#f59e0b" title="Ish maydoni" desc="Tizimga kirganingizda nima ko'rinadi" auto>
          <CSelect label="Boshlang'ich sahifa" desc="Kirgach ochiladigan bo'lim" value={s("startPage")} onChange={(v) => set("startPage", v)} options={[["/", "Dashboard"], ["/requests", "Zayavkalar"], ["/openings", "Ochilish"], ["/assets", "Aktivlar"], ["/budgets", "Budjet"]]} />
          <CSelect label="Default filial" desc="Asosiy ish filialingiz" value={s("defBranch")} onChange={(v) => set("defBranch", v)} options={[["", "— tanlanmagan —"], ...branches.map((x) => [String(x.id), x.name] as [string, string])]} />
          <div className="py-4">
            <div className="text-sm font-medium">Sevimli modullar</div>
            <div className="text-xs mt-0.5 mb-2.5" style={{ color: "var(--muted)" }}>Sidebar tepasida tez kirish uchun</div>
            <div className="flex flex-wrap gap-2">
              {[["requests", "Zayavkalar"], ["openings", "Ochilish"], ["assets", "Aktivlar"], ["budgets", "Budjet"], ["inventory", "Inventarizatsiya"]].map(([k, l]) => {
                const fav = (p.favModules as string[]).includes(k);
                return <button key={k} onClick={() => set("favModules", fav ? (p.favModules as string[]).filter((x) => x !== k) : [...(p.favModules as string[]), k])} className="px-3 py-1.5 rounded-full text-xs font-medium transition" style={fav ? { background: "var(--brand)", color: "#fff" } : { background: "var(--surface-2)", color: "var(--muted)" }}>{fav ? "★ " : ""}{l}</button>;
              })}
            </div>
          </div>
        </CGroup>
      ),
    },
    {
      id: "search", icon: "🔍", accent: "#22c55e", group: "Ishni sozlash", title: "Global qidiruv", desc: "Ctrl + K qidiruvida nima izlansin",
      content: (
        <CGroup icon="🔍" accent="#22c55e" title="Qidiruv qamrovi" desc="Ctrl + K bosilganda qaysi ma'lumotlar qidirilsin" auto>
          <SwRow label="Zayavkalar" desc="Zayavka raqami va mavzusi" checked={b("sReq")} onChange={(v) => set("sReq", v)} />
          <SwRow label="Aktivlar" desc="Inventar va jihozlar" checked={b("sAssets")} onChange={(v) => set("sAssets", v)} />
          <SwRow label="Filiallar" desc="Filial nomlari" checked={b("sBranches")} onChange={(v) => set("sBranches", v)} />
          <SwRow label="Hujjatlar" desc="Chek, nakladnoy, shartnoma" checked={b("sDocs")} onChange={(v) => set("sDocs", v)} />
          <SwRow label="Xodimlar" desc="Foydalanuvchi ismlari" checked={b("sStaff")} onChange={(v) => set("sStaff", v)} />
        </CGroup>
      ),
    },
    {
      id: "security", icon: "🔒", accent: "#ef4444", group: "Xavfsizlik", title: "Xavfsizlik", desc: "Sessiyalar va qurilmalar",
      content: (
        <CGroup icon="🔒" accent="#ef4444" title="Faol sessiyalar" desc="Hisobingizga kirgan qurilmalar">
          <div className="py-3 space-y-2">
            <div className="flex items-center gap-3 rounded-xl px-3 py-3" style={{ background: "var(--surface-2)" }}>
              <span className="text-xl">💻</span>
              <div className="flex-1 min-w-0"><div className="text-sm font-medium">Joriy qurilma</div><div className="text-[11px]" style={{ color: "var(--muted)" }}>Hozir faol · shu brauzer</div></div>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: "#22c55e1f", color: "#22c55e" }}>Faol</span>
            </div>
          </div>
          <ActionRow label="Login tarixi" desc="Oxirgi kirishlar ro'yxati" btn="Ko'rish" soon />
          <div className="py-4">
            <form action={logoutAction}><button className="btn btn-danger !px-5">Barcha qurilmalardan chiqish</button></form>
            <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>Bu joriy sessiyani yakunlaydi va qaytadan kirishni talab qiladi.</p>
          </div>
        </CGroup>
      ),
    },
    {
      id: "backup", icon: "💾", accent: "#3b82f6", group: "Xavfsizlik", title: "Sozlamalar zaxirasi", desc: "Eksport, import va tiklash",
      content: (
        <CGroup icon="💾" accent="#3b82f6" title="Shaxsiy sozlamalar" desc="Faqat sizning interfeys afzalliklaringiz (kompaniya ma'lumoti emas)">
          <ActionRow label="Sozlamalarni eksport qilish" desc="JSON fayl sifatida yuklab olish" btn="Eksport" onClick={() => {
            const blob = new Blob([JSON.stringify(p, null, 2)], { type: "application/json" });
            const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "axo-sozlamalar.json"; a.click();
          }} />
          <ActionRow label="Default holatga qaytarish" desc="Barcha afzalliklarni tiklash" btn="Tiklash" danger onClick={() => { setP(DEFAULTS); document.documentElement.style.fontSize = "16px"; document.documentElement.style.setProperty("--brand", "#2563eb"); document.documentElement.classList.remove("no-anim"); }} />
        </CGroup>
      ),
    },
    {
      id: "about", icon: "ℹ️", accent: "#64748b", group: "Xavfsizlik", title: "Dastur haqida", desc: "Versiya, yangilanish va yordam", status: "v1.0", statusTone: "#64748b",
      content: (
        <CGroup icon="ℹ️" accent="#64748b" title="AXO-OPEN GROUP" desc="Enterprise Resource Planning">
          <div className="py-4 grid sm:grid-cols-2 gap-2 text-sm">
            {[["Versiya", "v1.0"], ["Yangilanishlar", "Avtomatik"], ["Litsenziya", "Enterprise"], ["Holat", "Barqaror"]].map(([l, v]) => (
              <div key={l} className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: "var(--surface-2)" }}><span style={{ color: "var(--muted)" }}>{l}</span><span className="font-medium">{v}</span></div>
            ))}
          </div>
          <ActionRow label="Support" desc="Yordam va texnik qo'llab-quvvatlash" btn="Bog'lanish" soon />
          <ActionRow label="Release Notes" desc="So'nggi o'zgarishlar" btn="Ko'rish" soon />
        </CGroup>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-medium mb-1" style={{ color: "var(--muted)" }}>Shaxsiy</div>
        <h1 className="text-2xl font-bold tracking-tight">Sozlamalar</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Ish muhitingizni o&apos;zingizga moslang — o&apos;zgarishlar avtomatik saqlanadi</p>
      </div>
      <SettingsHub sections={sections} />
    </div>
  );
}

// ---------------- Client primitivlar ----------------
const surf = { background: "var(--surface)", borderColor: "var(--border)" };

function CGroup({ icon, accent, title, desc, auto, footNote, children }: { icon: string; accent: string; title: string; desc?: string; auto?: boolean; footNote?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ ...surf, boxShadow: "0 1px 2px rgba(0,0,0,.06), 0 8px 24px -16px rgba(0,0,0,.4)" }}>
      <div className="flex items-start gap-3 px-5 py-4">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: `${accent}1f`, color: accent }}>{icon}</span>
        <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold tracking-tight">{title}</h3>{desc && <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{desc}</p>}</div>
        {auto && <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>Avto-saqlash</span>}
      </div>
      <div className="border-t" style={{ borderColor: "var(--border)" }} />
      <div className="px-5 divide-y" style={{ borderColor: "var(--border)" }}>{children}</div>
      {footNote && <div className="px-5 py-2.5 border-t text-[11px]" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>{footNote}</div>}
    </div>
  );
}

function CRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-6 py-4">
      <div className="sm:flex-1 min-w-0"><div className="text-sm font-medium">{label}</div>{desc && <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{desc}</div>}</div>
      <div className="w-full sm:w-60 shrink-0 sm:flex sm:justify-end">{children}</div>
    </div>
  );
}

function CInput({ label, desc, value, placeholder, onChange }: { label: string; desc?: string; value: string; placeholder?: string; onChange: (v: string) => void }) {
  return <CRow label={label} desc={desc}><input value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="input" /></CRow>;
}

function CSelect({ label, desc, value, options, onChange }: { label: string; desc?: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return <CRow label={label} desc={desc}><select value={value} onChange={(e) => onChange(e.target.value)} className="select">{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></CRow>;
}

function Segmented({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex p-0.5 rounded-xl w-full sm:w-auto" style={{ background: "var(--surface-2)" }}>
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)} className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-medium transition" style={value === v ? { background: "var(--surface)", color: "var(--text)", boxShadow: "0 1px 3px rgba(0,0,0,.15)" } : { color: "var(--muted)" }}>{l}</button>
      ))}
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="relative w-11 h-6 rounded-full transition-colors shrink-0" style={{ background: checked ? "var(--brand)" : "var(--surface-2)", border: `1px solid ${checked ? "var(--brand)" : "var(--border)"}` }}>
      <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all" style={{ left: checked ? "1.375rem" : "0.125rem" }} />
    </button>
  );
}

function SwRow({ label, desc, checked, onChange, soon }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void; soon?: boolean }) {
  return (
    <CRow label={label} desc={desc}>
      <div className="flex items-center gap-2 sm:justify-end">
        {soon && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>tez orada</span>}
        <Switch checked={!!checked} onChange={onChange} />
      </div>
    </CRow>
  );
}

function ActionRow({ label, desc, btn, onClick, soon, danger }: { label: string; desc?: string; btn: string; onClick?: () => void; soon?: boolean; danger?: boolean }) {
  return (
    <CRow label={label} desc={desc}>
      <div className="flex items-center gap-2 sm:justify-end">
        {soon && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>tez orada</span>}
        <button onClick={onClick} disabled={soon} className={`btn ${danger ? "btn-ghost !text-danger" : "btn-ghost"} !px-4 ${soon ? "opacity-50 cursor-not-allowed" : ""}`}>{btn}</button>
      </div>
    </CRow>
  );
}
