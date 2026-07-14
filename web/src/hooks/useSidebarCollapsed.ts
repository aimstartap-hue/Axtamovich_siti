"use client";

import { useSyncExternalStore } from "react";

// Sidebar collapse holati — localStorage'da saqlanadi, useSyncExternalStore orqali
// hydration mismatch'siz o'qiladi (server/hydration = default collapsed, keyin
// localStorage qiymatiga o'tadi). setState-in-effect yo'q.
const KEY = "axo:sidebar-collapsed";
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  window.addEventListener("storage", cb); // boshqa tab'lar bilan sinxron
  return () => { listeners.delete(cb); window.removeEventListener("storage", cb); };
}

function getSnapshot(): boolean {
  try { return localStorage.getItem(KEY) !== "0"; } catch { return true; } // default: collapsed
}
function getServerSnapshot(): boolean { return true; }

/** [collapsed, toggle] — collapse holati va uni almashtiruvchi funksiya. */
export function useSidebarCollapsed(): [boolean, () => void] {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggle = () => {
    try { localStorage.setItem(KEY, collapsed ? "0" : "1"); } catch {}
    emit();
  };
  return [collapsed, toggle];
}
