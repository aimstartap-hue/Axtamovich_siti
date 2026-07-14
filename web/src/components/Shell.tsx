"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { X, Menu, Plus, Building2, ShieldPlus, Bell, Search, ChevronUp, LogOut } from "lucide-react";
import { ROLES, OPENING_ROLES, type Role } from "@/lib/constants";
import { logoutAction } from "@/app/(auth)/actions";

interface NavItem { href?: string; label: string; icon: string; roles?: Role[]; soon?: boolean; badge?: string; badgeColor?: string; }

// Menyu — mavjud sahifalar havola; hali yaratilmagan modullar "tez orada" (route buzilmasin).
const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/requests", label: "Zayavkalar", icon: "📄" },
  { href: "/budgets", label: "Budjet", icon: "💰" },
  { href: "/openings", label: "Ochilish", icon: "🚀", roles: OPENING_ROLES },
  { href: "/assets", label: "Aktivlar", icon: "🏢" },
  { label: "Inventarizatsiya", icon: "📦", soon: true },
  { label: "Ta'mirlash", icon: "🔧", soon: true },
  { href: "/admin", label: "Sozlamalar", icon: "⚙" },
];

const QUICK = [
  { href: "/requests/new", label: "Yangi zayavka", Icon: Plus },
  { href: "/admin#branches", label: "Filial qo'shish", Icon: Building2 },
  { href: "/admin#perms", label: "Rol yaratish", Icon: ShieldPlus },
  { href: "/notifications", label: "Bildirishnoma", Icon: Bell },
];

const activeGrad = "linear-gradient(90deg, #2563eb, #4f8ef7)";
const logoGrad = "linear-gradient(135deg, #2563eb, #7aa8ff)";

export default function Shell({
  children, fullName, role, orgName, unread,
}: {
  children: React.ReactNode;
  fullName: string;
  role: Role;
  orgName: string;
  unread: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const isActive = (href?: string) => (!href ? false : href === "/" ? pathname === "/" : pathname.startsWith(href));
  const nav = NAV.filter((n) => !n.roles || n.roles.includes(role));
  const initial = (fullName.trim()[0] || "A").toUpperCase();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); searchRef.current?.focus(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggleTheme() {
    const el = document.documentElement;
    const dark = el.classList.toggle("dark");
    el.dataset.theme = dark ? "dark" : "light";
    try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch {}
  }
  function onSearch(e: React.KeyboardEvent) {
    if (e.key === "Enter" && q.trim()) { router.push(`/requests?q=${encodeURIComponent(q.trim())}`); setQ(""); searchRef.current?.blur(); }
  }

  const menuItem = (n: NavItem, onClick?: () => void) => {
    const active = isActive(n.href);
    const inner = (
      <>
        <span className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 transition"
          style={active ? { background: "rgba(255,255,255,0.2)" } : { background: "var(--surface-2)" }}>{n.icon}</span>
        <span className="flex-1 truncate">{n.label}</span>
        {n.badge && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 text-white" style={{ background: n.badgeColor }}>{n.badge}</span>}
        {n.soon && <span className="text-[9px] px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>tez orada</span>}
      </>
    );
    if (n.soon || !n.href) return <div key={n.label} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium cursor-not-allowed opacity-55" title="Tez orada">{inner}</div>;
    return (
      <Link key={`${n.href}-${n.label}`} href={n.href} onClick={onClick} aria-current={active ? "page" : undefined}
        className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-all duration-150 ${active ? "text-white" : "text-text hover:bg-surface-2 hover:translate-x-0.5"}`}
        style={active ? { background: activeGrad, boxShadow: "0 4px 14px rgba(37,99,235,0.35)" } : undefined}>
        {inner}
      </Link>
    );
  };

  const userCard = (dropUp: boolean) => (
    <div className="p-3 border-t border-border shrink-0 relative">
      {userMenu && (
        <div className={`absolute left-3 right-3 rounded-xl overflow-hidden shadow-2xl z-10 ${dropUp ? "bottom-full mb-2" : "top-full mt-2"}`} style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <Link href="/notifications" onClick={() => setUserMenu(false)} className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-surface-2"><Bell size={15} className="text-muted" /> Bildirishnomalar</Link>
          <form action={logoutAction}><button className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-surface-2 text-danger"><LogOut size={15} /> Chiqish</button></form>
        </div>
      )}
      <button onClick={() => setUserMenu((v) => !v)} className="w-full flex items-center gap-2.5 rounded-xl p-1.5 hover:bg-surface-2 transition">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shrink-0 text-sm" style={{ background: logoGrad }}>{initial}</span>
        <span className="flex-1 min-w-0 text-left"><span className="block text-sm font-semibold truncate">{fullName}</span><span className="block text-[11px] text-muted truncate">{ROLES[role]}</span></span>
        <ChevronUp size={15} className="text-muted shrink-0 transition" style={{ transform: userMenu ? "rotate(0)" : "rotate(180deg)" }} />
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (desktop) — premium, doim ochiq */}
      <aside className="hidden md:flex md:flex-col w-64 shrink-0 border-r border-border bg-surface">
        <div className="p-3 shrink-0">
          <div className="flex items-center gap-3 rounded-2xl p-3" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--brand) 16%, var(--surface-2)), var(--surface-2))", border: "1px solid var(--border)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shrink-0 text-lg" style={{ background: logoGrad, boxShadow: "0 4px 14px rgba(37,99,235,0.4)" }}>A</div>
            <div className="min-w-0"><div className="font-bold text-sm leading-tight tracking-tight">AXO-OPEN GROUP</div><div className="text-[11px] text-muted truncate">{orgName}</div></div>
          </div>
        </div>

        <nav className="flex-1 px-3 pb-2 space-y-0.5 overflow-y-auto">{nav.map((n) => menuItem(n))}</nav>

        <div className="px-3 py-3 border-t border-border shrink-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2 px-1">Tezkor amallar</div>
          <div className="grid grid-cols-2 gap-1.5">
            {QUICK.map(({ href, label, Icon }) => (
              <Link key={href} href={href} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium hover:bg-surface-2 transition" style={{ background: "var(--surface-2)" }}>
                <Icon size={13} className="text-brand shrink-0" /><span className="truncate">{label}</span>
              </Link>
            ))}
          </div>
        </div>

        {userCard(true)}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex items-center gap-3 px-4 h-14 border-b border-border bg-surface/80 backdrop-blur-md">
          <button className="md:hidden p-1.5 -ml-1.5 rounded-lg hover:bg-surface-2" onClick={() => setMobileOpen(true)} aria-label="Menyu"><Menu size={20} /></button>
          <div className="font-semibold md:hidden">{orgName}</div>

          <div className="relative hidden sm:block w-full max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
            <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onSearch} placeholder="Qidirish…"
              className="w-full text-sm pl-9 pr-12 py-2 rounded-xl outline-none focus:ring-2 transition" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }} />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}>Ctrl K</kbd>
          </div>

          <div className="flex-1" />
          <Link href="/notifications" className="relative p-2 rounded-lg hover:bg-surface-2 transition" aria-label="Bildirishnomalar">
            <Bell size={19} />
            {unread > 0 && <span className="absolute top-0.5 right-0.5 bg-danger text-white text-[9px] rounded-full min-w-4 h-4 px-1 flex items-center justify-center">{unread > 9 ? "9+" : unread}</span>}
          </Link>
          <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-surface-2 transition text-lg leading-none" aria-label="Mavzu">🌓</button>
          <form action={logoutAction}><button className="btn btn-ghost !py-1.5 !px-3 text-sm" type="submit">Chiqish</button></form>
        </header>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="md:hidden">
            <div className="fixed inset-0 z-40 animate-fade" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setMobileOpen(false)} />
            <aside className="fixed left-0 top-0 bottom-0 z-50 w-64 flex flex-col bg-surface border-r border-border animate-drawer-left" role="dialog" aria-modal="true" aria-label="Navigatsiya">
              <div className="flex items-center justify-between gap-2 p-3 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shrink-0" style={{ background: logoGrad }}>A</div>
                  <div className="min-w-0"><div className="font-bold text-sm leading-tight">AXO-OPEN GROUP</div><div className="text-[11px] text-muted truncate">{orgName}</div></div>
                </div>
                <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-surface-2" aria-label="Yopish"><X size={18} /></button>
              </div>
              <nav className="flex-1 px-3 pb-2 space-y-0.5 overflow-y-auto">{nav.map((n) => menuItem(n, () => setMobileOpen(false)))}</nav>
              {userCard(true)}
            </aside>
          </div>
        )}

        <main className="flex-1 w-full p-4 md:p-6 2xl:px-10 pb-20 md:pb-6">{children}</main>

        <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 flex border-t border-border bg-surface">
          {nav.filter((n) => n.href && !n.badge).slice(0, 5).map((n) => (
            <Link key={n.href} href={n.href!} className={`flex-1 flex flex-col items-center py-2 text-[11px] ${isActive(n.href) ? "text-brand" : "text-muted"}`}>
              <span className="text-lg">{n.icon}</span>{n.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
