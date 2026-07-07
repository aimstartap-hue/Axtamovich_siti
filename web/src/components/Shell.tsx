"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ROLES, FINANCE_ROLES, OPENING_ROLES, CEO_ROLES, type Role } from "@/lib/constants";
import { logoutAction } from "@/app/(auth)/actions";

interface NavItem { href: string; label: string; icon: string; roles?: Role[]; }

const NAV: NavItem[] = [
  { href: "/", label: "Bosh sahifa", icon: "🏠" },
  { href: "/ceo", label: "CEO", icon: "👔", roles: CEO_ROLES },
  { href: "/requests", label: "Zayavkalar", icon: "📋" },
  { href: "/budgets", label: "Byudjet", icon: "💰" },
  { href: "/openings", label: "Ochilish", icon: "🏗", roles: OPENING_ROLES },
  { href: "/analytics", label: "Moliya", icon: "📈", roles: FINANCE_ROLES },
  { href: "/assets", label: "Aktivlar", icon: "🧰" },
  { href: "/limits", label: "Limitlar", icon: "📊" },
  { href: "/admin", label: "Sozlamalar", icon: "⚙️" },
];

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
  const [menuOpen, setMenuOpen] = useState(false);
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const nav = NAV.filter((n) => !n.roles || n.roles.includes(role));

  function toggleTheme() {
    const el = document.documentElement;
    const dark = el.classList.toggle("dark");
    el.dataset.theme = dark ? "dark" : "light";
    try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch {}
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-border bg-surface">
        <div className="p-4 border-b border-border">
          <div className="font-bold text-brand">AXO-OPEN</div>
          <div className="text-xs text-muted truncate">{orgName}</div>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {nav.map((n) => (
            <Link key={n.href} href={n.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                isActive(n.href) ? "bg-brand text-brand-fg" : "hover:bg-surface-2 text-text"
              }`}>
              <span>{n.icon}</span> {n.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-border text-xs">
          <div className="font-semibold truncate">{fullName}</div>
          <div className="text-muted">{ROLES[role]}</div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex items-center gap-3 px-4 h-14 border-b border-border bg-surface/90 backdrop-blur">
          <button className="md:hidden text-xl" onClick={() => setMenuOpen((v) => !v)} aria-label="Menyu">☰</button>
          <div className="font-semibold md:hidden">{orgName}</div>
          <div className="flex-1" />
          <Link href="/notifications" className="relative text-xl" aria-label="Bildirishnomalar">
            🔔
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 bg-danger text-white text-[10px] rounded-full min-w-4 h-4 px-1 flex items-center justify-center">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          <button onClick={toggleTheme} className="text-xl" aria-label="Mavzu">🌓</button>
          <form action={logoutAction}>
            <button className="btn btn-ghost !py-1.5 !px-3 text-sm" type="submit">Chiqish</button>
          </form>
        </header>

        {/* Mobile menu drawer */}
        {menuOpen && (
          <div className="md:hidden border-b border-border bg-surface p-2 space-y-1">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${
                  isActive(n.href) ? "bg-brand text-brand-fg" : "hover:bg-surface-2"
                }`}>
                <span>{n.icon}</span> {n.label}
              </Link>
            ))}
          </div>
        )}

        <main className="flex-1 p-4 md:p-6 max-w-5xl w-full mx-auto pb-20 md:pb-6">{children}</main>

        {/* Bottom nav (mobile) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 flex border-t border-border bg-surface">
          {nav.slice(0, 5).map((n) => (
            <Link key={n.href} href={n.href}
              className={`flex-1 flex flex-col items-center py-2 text-[11px] ${
                isActive(n.href) ? "text-brand" : "text-muted"
              }`}>
              <span className="text-lg">{n.icon}</span>{n.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
