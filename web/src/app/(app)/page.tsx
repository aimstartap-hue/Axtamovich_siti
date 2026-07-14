import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { needsAction } from "@/lib/workflow";
import { isOpen, isOverdue, branchLabel } from "@/lib/helpers";
import { FINANCE_ROLES, ROLES, STATUS_LABELS, STATUS_COLOR, REQUEST_TYPES } from "@/lib/constants";
import ManagerDashboard from "@/components/dashboards/ManagerDashboard";
import RegmenDashboard from "@/components/dashboards/RegmenDashboard";
import AxoDashboard from "@/components/dashboards/AxoDashboard";
import FinanceDashboard from "@/components/finance/FinanceDashboard";
import HomeBoard, { type HomeData } from "@/components/dashboards/HomeBoard";
import { CeoView } from "./ceo/page";
import type { RequestRow } from "@/lib/types";

export const dynamic = "force-dynamic";

type SP = Promise<{ period?: string; type?: string; from?: string; to?: string }>;

export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  const profile = await requireProfile();

  // Rolga qarab alohida bosh sahifa
  // CEO uchun bosh sahifaning O'ZI CEO dashboardidir (faqat ceo rolига ta'sir qiladi).
  if (profile.role === "ceo") return <CeoView />;
  if (FINANCE_ROLES.includes(profile.role)) return <FinanceDashboard sp={await searchParams} profile={profile} />;
  if (profile.role === "branch_manager") return <ManagerDashboard profile={profile} />;
  if (profile.role === "regmen") return <RegmenDashboard profile={profile} />;
  if (profile.role === "axo") return <AxoDashboard profile={profile} />;
  return <GenericDashboard profile={profile} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Umumiy bosh sahifa (open_group / hr / boshqalar) — premium ERP dashboard.
// Faqat UI qatlami yangilandi; barcha ma'lumot real Supabase'dan hisoblanadi.
// ─────────────────────────────────────────────────────────────────────────────

const UZ_MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
const UZ_WEEKDAYS = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];

function bucketOf(s: string): string {
  if (s === "pending_axo") return "new";
  if (["pending_ceo", "pending_finance", "deadline_dispute", "hr_review"].includes(s)) return "approving";
  if (s === "closed") return "closed";
  if (s === "rejected") return "rejected";
  return "inprogress";
}

function shortMoney(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, "")} mlrd`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")} M so'm`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} ming`;
  return String(Math.round(n));
}

function sameDay(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}

function hhmm(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

function activityTone(action: string): string {
  const a = action.toLowerCase();
  if (a.includes("rad")) return "danger";
  if (a.includes("tasdiq") || a.includes("yopdi") || a.includes("faollash") || a.includes("hal qildi")) return "success";
  if (a.includes("yaratildi") || a.includes("topshiril") || a.includes("takrorlan")) return "brand";
  return "muted";
}

async function GenericDashboard({ profile }: { profile: Awaited<ReturnType<typeof requireProfile>> }) {
  const sb = await createClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [{ data: reqs }, { data: branches }, { data: events }, { count: userCount }] = await Promise.all([
    sb.from("requests")
      .select("id, type, title, status, created_at, deadline, priority, branch_id, created_by, rejected_by, deadline_disputed, estimated_amount, estimated_category, paid, paid_at")
      .order("id", { ascending: false }),
    sb.from("branches").select("id, name"),
    sb.from("events").select("id, request_id, action, created_at").order("id", { ascending: false }).limit(8),
    sb.from("profiles").select("id", { count: "exact", head: true }),
  ]);

  const all = (reqs ?? []) as RequestRow[];
  const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]));
  const reqById = new Map(all.map((r) => [r.id, r]));

  const open = all.filter((r) => isOpen(r.status));
  const closed = all.filter((r) => r.status === "closed");
  const myTasks = all.filter((r) => needsAction(r, profile.role));
  const overdue = all.filter((r) => isOverdue(r));
  const createdToday = all.filter((r) => sameDay(r.created_at, now));
  const openToday = createdToday.filter((r) => isOpen(r.status));
  const closedThisMonth = closed.filter((r) => new Date(r.created_at) >= monthStart);

  // ── Pul: to'langan (bu oy) vs o'tgan oy; kutilayotgan ──
  const paidThisMonth = all.filter((r) => r.paid && r.paid_at && new Date(r.paid_at) >= monthStart)
    .reduce((s, r) => s + (r.estimated_amount ?? 0), 0);
  const paidPrevMonth = all.filter((r) => r.paid && r.paid_at && new Date(r.paid_at) >= prevMonthStart && new Date(r.paid_at) < monthStart)
    .reduce((s, r) => s + (r.estimated_amount ?? 0), 0);
  const pendingAmount = open.reduce((s, r) => s + (r.estimated_amount ?? 0), 0);
  const paidTrend = paidPrevMonth > 0 ? Math.round(((paidThisMonth - paidPrevMonth) / paidPrevMonth) * 100) : 0;

  // ── KPI kartalari ──
  const kpis: HomeData["kpis"] = [
    { key: "total", icon: "📄", label: "Jami zayavka", value: String(all.length), sub: `+${createdToday.length} bugun`, trend: createdToday.length ? "up" : "flat", grad: "linear-gradient(135deg,#1e3a8a,#2563eb)" },
    { key: "open", icon: "📂", label: "Ochiq zayavka", value: String(open.length), sub: `+${openToday.length} bugun`, trend: openToday.length ? "up" : "flat", grad: "linear-gradient(135deg,#166534,#22c55e)" },
    { key: "mine", icon: "⏱", label: "Sizdan harakat", value: String(myTasks.length), sub: myTasks.length ? "e'tibor kerak" : "toza", trend: myTasks.length ? "up" : "flat", grad: "linear-gradient(135deg,#6d28d9,#a855f7)" },
    { key: "closed", icon: "✅", label: "Yopilgan zayavka", value: String(closed.length), sub: `+${closedThisMonth.length} bu oy`, trend: closedThisMonth.length ? "up" : "flat", grad: "linear-gradient(135deg,#0f766e,#14b8a6)" },
    { key: "paid", icon: "💳", label: "To'langan (bu oy)", value: shortMoney(paidThisMonth), sub: paidTrend ? `${paidTrend > 0 ? "+" : ""}${paidTrend}% oy` : "o'zgarishsiz", trend: paidTrend > 0 ? "up" : paidTrend < 0 ? "down" : "flat", grad: "linear-gradient(135deg,#b45309,#f59e0b)" },
    { key: "pending", icon: "⌛", label: "Kutilayotgan to'lov", value: shortMoney(pendingAmount), sub: `${overdue.length} ta kechikkan`, trend: overdue.length ? "down" : "flat", grad: "linear-gradient(135deg,#9f1239,#f43f5e)" },
  ];

  // ── So'nggi zayavkalar ──
  const recent: HomeData["recent"] = all.slice(0, 12).map((r) => ({
    id: r.id,
    code: `ZV-${new Date(r.created_at).getFullYear()}-${r.id}`,
    title: r.title,
    branch: r.branch_id ? branchLabel(branchName.get(r.branch_id) ?? "—") : "—",
    date: new Intl.DateTimeFormat("ru-RU").format(new Date(r.created_at)),
    status: STATUS_LABELS[r.status] ?? r.status,
    color: STATUS_COLOR[r.status] ?? "blue",
    bucket: bucketOf(r.status),
  }));

  // ── Donut: holat taqsimoti ──
  const DIST_META = [
    { key: "new", label: "Yangi", color: "#f59e0b" },
    { key: "approving", label: "Tasdiqlashda", color: "#06b6d4" },
    { key: "inprogress", label: "Jarayonda", color: "#2563eb" },
    { key: "closed", label: "Yopilgan", color: "#22c55e" },
    { key: "rejected", label: "Rad etilgan", color: "#ef4444" },
  ];
  const statusDist: HomeData["statusDist"] = DIST_META.map((m) => ({
    ...m, value: all.filter((r) => bucketOf(r.status) === m.key).length,
  })).filter((d) => d.value > 0);

  // ── Filiallar bo'yicha (top 5) ──
  const branchCount = new Map<number, number>();
  for (const r of all) if (r.branch_id) branchCount.set(r.branch_id, (branchCount.get(r.branch_id) ?? 0) + 1);
  const branchBars: HomeData["branchBars"] = [...branchCount.entries()]
    .map(([id, value]) => ({ label: branchLabel(branchName.get(id) ?? `#${id}`), value }))
    .sort((a, b) => b.value - a.value).slice(0, 5);

  // ── Dinamika (30 kun, yangi zayavka soni) ──
  const dynamics: HomeData["dynamics"] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const value = all.filter((r) => sameDay(r.created_at, d)).length;
    dynamics.push({ label: `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`, value });
  }

  // ── Yo'nalish bo'yicha (kategoriya / tur) ──
  const catCount = new Map<string, number>();
  for (const r of all) {
    const key = r.estimated_category || REQUEST_TYPES[r.type] || "Boshqa";
    catCount.set(key, (catCount.get(key) ?? 0) + 1);
  }
  const sortedCats = [...catCount.entries()].sort((a, b) => b[1] - a[1]);
  const top = sortedCats.slice(0, 5);
  const rest = sortedCats.slice(5).reduce((s, [, v]) => s + v, 0);
  if (rest > 0) top.push(["Boshqa", rest]);
  const typeTotal = all.length || 1;
  const typeDist: HomeData["typeDist"] = top.map(([label, value]) => ({
    label, value, pct: Math.round((value / typeTotal) * 100),
  }));

  // ── Tezkor ma'lumotlar ──
  const quickInfo: HomeData["quickInfo"] = [
    { icon: "🆕", label: "Bugungi zayavkalar", value: String(createdToday.length), tone: "brand" },
    { icon: "⚠️", label: "Kechikkan zayavkalar", value: String(overdue.length), tone: "danger" },
    { icon: "📌", label: "Mening ochiq ishlarim", value: String(myTasks.length), tone: "warning" },
    { icon: "🏢", label: "Jami filiallar", value: String((branches ?? []).length), tone: "violet" },
    { icon: "👥", label: "Foydalanuvchilar", value: String(userCount ?? 0), tone: "success" },
    { icon: "🎫", label: "Sizning rolingiz", value: ROLES[profile.role] ?? profile.role, tone: "brand" },
  ];

  // ── So'nggi faoliyatlar (events) ──
  const activity: HomeData["activity"] = (events ?? []).map((e) => {
    const r = reqById.get(e.request_id);
    return {
      id: e.id,
      text: e.action,
      code: r ? `ZV-${new Date(r.created_at).getFullYear()}-${r.id}` : `#${e.request_id}`,
      time: sameDay(e.created_at, now) ? hhmm(e.created_at) : new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" }).format(new Date(e.created_at)),
      tone: activityTone(e.action),
    };
  });

  // ── Eslatma va bildirishnomalar (real hodisalardan) ──
  const todayEvents = (events ?? []).filter((e) => sameDay(e.created_at, now));
  const approvedToday = todayEvents.filter((e) => e.action.toLowerCase().includes("tasdiq")).length;
  const reminders: HomeData["reminders"] = [];
  if (overdue.length > 0) reminders.push({ icon: "bell", title: "Kechikkan zayavkalar", sub: `${overdue.length} ta zayavka muddati o'tgan`, time: "Hozir", tone: "danger" });
  if (myTasks.length > 0) reminders.push({ icon: "📥", title: "Sizdan harakat kutilmoqda", sub: `${myTasks.length} ta zayavka e'tibor talab qiladi`, time: "Bugun", tone: "warning" });
  if (approvedToday > 0) reminders.push({ icon: "✅", title: "Tasdiqlangan zayavkalar", sub: `Bugun ${approvedToday} ta zayavka tasdiqlandi`, time: "Bugun", tone: "success" });

  const data: HomeData = {
    firstName: profile.full_name.split(" ")[0] || profile.full_name,
    fullName: profile.full_name,
    roleLabel: ROLES[profile.role] ?? profile.role,
    dateLabel: `${now.getDate()} ${UZ_MONTHS[now.getMonth()]}, ${now.getFullYear()}`,
    weekday: UZ_WEEKDAYS[now.getDay()],
    newRequestHref: "/requests/new",
    kpis, recent, statusDist, branchBars, dynamics, typeDist, quickInfo, activity, reminders,
  };

  return <HomeBoard data={data} />;
}
