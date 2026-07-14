"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell, ArrowRight, TrendingUp, TrendingDown, Minus, RefreshCw,
} from "lucide-react";

// =============================================================================
// AXO-OPEN GROUP — Bosh sahifa (premium ERP dashboard) — faqat UI qatlami.
// Barcha ma'lumot serverdan (Supabase) keladi; bu komponent hech nima hisoblamaydi,
// faqat premium ko'rinishda chizadi va interaktivlikni beradi.
// =============================================================================

export interface Kpi {
  key: string;
  icon: string;
  label: string;
  value: string;
  sub: string;
  trend: "up" | "down" | "flat";
  grad: string;
}
export interface RecentRow {
  id: number;
  code: string;
  title: string;
  branch: string;
  date: string;
  status: string;      // status label
  color: string;       // badge color name (amber/blue/…)
  bucket: string;      // donut bucket key
}
export interface DistItem { key: string; label: string; color: string; value: number; }
export interface BarItem { label: string; value: number; }
export interface DynPoint { label: string; value: number; }
export interface TypeItem { label: string; value: number; pct: number; }
export interface InfoRow { icon: string; label: string; value: string; tone?: string; }
export interface ActivityItem { id: number; text: string; code: string; time: string; tone: string; }
export interface ReminderItem { icon: string; title: string; sub: string; time: string; tone: string; }

export interface HomeData {
  firstName: string;
  fullName: string;
  roleLabel: string;
  dateLabel: string;
  weekday: string;
  newRequestHref: string;
  kpis: Kpi[];
  recent: RecentRow[];
  statusDist: DistItem[];
  branchBars: BarItem[];
  dynamics: DynPoint[];
  typeDist: TypeItem[];
  quickInfo: InfoRow[];
  activity: ActivityItem[];
  reminders: ReminderItem[];
}

const TONE: Record<string, string> = {
  danger: "#ef4444", success: "#22c55e", brand: "#2563eb",
  warning: "#f59e0b", violet: "#8b5cf6", muted: "#94a3b8",
};

const BADGE_HEX: Record<string, string> = {
  amber: "#f59e0b", orange: "#fb923c", blue: "#3b82f6",
  violet: "#8b5cf6", green: "#22c55e", red: "#ef4444",
};

// ── Kichik qismlar ──────────────────────────────────────────────────────────

function CardHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 pt-4 pb-3">
      <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
      {action}
    </div>
  );
}

function panel(extra = ""): string {
  return `rounded-2xl border ${extra}`;
}

// ── Donut ─────────────────────────────────────────────────────────────────
function Donut({ dist, total, active, onPick }: {
  dist: DistItem[]; total: number; active: string | null; onPick: (k: string | null) => void;
}) {
  let acc = 0;
  const segs = dist.map((d) => {
    const frac = total ? d.value / total : 0;
    const seg = { ...d, len: frac * 100, offset: 25 - acc };
    acc += frac * 100;
    return seg;
  });
  return (
    <div className="flex flex-col sm:flex-row items-center gap-5 px-5 pb-5">
      <div className="relative shrink-0">
        <svg viewBox="0 0 42 42" className="w-40 h-40 -rotate-90">
          <circle cx="21" cy="21" r="15.915" fill="none" stroke="var(--surface-2)" strokeWidth="4.5" />
          {total > 0 && segs.map((s) => s.len > 0 && (
            <circle key={s.key} cx="21" cy="21" r="15.915" fill="none"
              stroke={s.color} strokeWidth={active === s.key ? 6 : 4.5}
              strokeDasharray={`${s.len} ${100 - s.len}`} strokeDashoffset={s.offset}
              strokeLinecap="round"
              style={{ transition: "stroke-width .2s, opacity .2s", opacity: active && active !== s.key ? 0.35 : 1, cursor: "pointer" }}
              onClick={() => onPick(active === s.key ? null : s.key)} />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold leading-none">{total.toLocaleString("ru-RU").replace(/,/g, " ")}</span>
          <span className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>Jami</span>
        </div>
      </div>
      <div className="flex-1 w-full space-y-1">
        {dist.map((d) => {
          const pct = total ? Math.round((d.value / total) * 100) : 0;
          const on = active === d.key;
          return (
            <button key={d.key} onClick={() => onPick(on ? null : d.key)}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition"
              style={{ background: on ? "var(--surface-2)" : "transparent" }}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
              <span className="flex-1 text-left truncate" style={{ fontWeight: on ? 600 : 400 }}>{d.label}</span>
              <span className="tabular-nums font-semibold" style={{ color: "var(--muted)" }}>{pct}%</span>
              <span className="tabular-nums text-xs w-8 text-right" style={{ color: "var(--muted)" }}>{d.value}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Dinamika (SVG line + area) ───────────────────────────────────────────────
function Dynamics({ points }: { points: DynPoint[] }) {
  const W = 520, H = 150, PAD = 8;
  const max = Math.max(1, ...points.map((p) => p.value));
  const n = points.length;
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / Math.max(1, n - 1);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);

  // 7 kunlik siljuvchi o'rtacha (dashed)
  const ma = points.map((_, i) => {
    const s = Math.max(0, i - 6);
    const slice = points.slice(s, i + 1);
    return slice.reduce((a, b) => a + b.value, 0) / slice.length;
  });

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.value)}`).join(" ");
  const area = `${line} L ${x(n - 1)} ${H - PAD} L ${x(0)} ${H - PAD} Z`;
  const maLine = ma.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
  const [hover, setHover] = useState<number | null>(null);

  return (
    <div className="px-5 pb-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}
        onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="dynFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={PAD} x2={W - PAD} y1={PAD + g * (H - PAD * 2)} y2={PAD + g * (H - PAD * 2)}
            stroke="var(--border)" strokeWidth="1" strokeDasharray="3 4" opacity="0.5" />
        ))}
        <path d={area} fill="url(#dynFill)" />
        <path d={maLine} fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.7" />
        <path d={line} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i}>
            <rect x={x(i) - (W / n) / 2} y={0} width={W / n} height={H} fill="transparent"
              onMouseEnter={() => setHover(i)} />
            {hover === i && (
              <>
                <line x1={x(i)} x2={x(i)} y1={PAD} y2={H - PAD} stroke="var(--border)" strokeWidth="1" />
                <circle cx={x(i)} cy={y(p.value)} r="4" fill="#2563eb" stroke="var(--surface)" strokeWidth="2" />
              </>
            )}
          </g>
        ))}
        {hover !== null && (
          <g>
            <rect x={Math.min(Math.max(x(hover) - 34, 2), W - 70)} y={6} width="68" height="34" rx="6"
              fill="var(--surface-2)" stroke="var(--border)" />
            <text x={Math.min(Math.max(x(hover), 36), W - 36)} y={20} textAnchor="middle"
              style={{ fontSize: 9, fill: "var(--muted)" }}>{points[hover].label}</text>
            <text x={Math.min(Math.max(x(hover), 36), W - 36)} y={33} textAnchor="middle"
              style={{ fontSize: 11, fontWeight: 700, fill: "var(--text)" }}>{points[hover].value} ta</text>
          </g>
        )}
      </svg>
      <div className="flex items-center justify-between text-[10px] mt-1" style={{ color: "var(--muted)" }}>
        <span>{points[0]?.label}</span>
        <span>{points[Math.floor(n / 2)]?.label}</span>
        <span>{points[n - 1]?.label}</span>
      </div>
      <div className="flex items-center gap-4 mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
        <span className="flex items-center gap-1.5"><span className="w-3 h-[2px] rounded" style={{ background: "#2563eb" }} />Yangi zayavka</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-[2px] rounded" style={{ background: "var(--muted)", opacity: .7 }} />O&apos;rtacha (7 kun)</span>
      </div>
    </div>
  );
}

// ── Asosiy komponent ─────────────────────────────────────────────────────────
export default function HomeBoard({ data }: { data: HomeData }) {
  const [bucket, setBucket] = useState<string | null>(null);
  const totalDist = data.statusDist.reduce((s, d) => s + d.value, 0);

  const recent = useMemo(
    () => (bucket ? data.recent.filter((r) => r.bucket === bucket) : data.recent).slice(0, 6),
    [bucket, data.recent],
  );
  const maxBar = Math.max(1, ...data.branchBars.map((b) => b.value));
  const border = { borderColor: "var(--border)" };
  const surf = { background: "var(--surface)" };

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">Salom, {data.firstName}! 👋</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
            Bugun {data.dateLabel} · {data.weekday}
          </p>
        </div>
        <Link href={data.newRequestHref}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:opacity-90 transition"
          style={{ background: "linear-gradient(135deg,#2563eb,#4f8ef7)", boxShadow: "0 6px 18px -6px rgba(37,99,235,.6)" }}>
          + Yangi zayavka
        </Link>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {data.kpis.map((k) => (
          <div key={k.key} title={`${k.label}: ${k.value}`}
            className="relative overflow-hidden rounded-2xl p-4 text-white transition-transform duration-200 hover:-translate-y-0.5"
            style={{ background: k.grad, boxShadow: "0 8px 24px -12px rgba(0,0,0,.5)" }}>
            <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-15" style={{ background: "#fff" }} />
            <div className="flex items-center justify-between">
              <span className="text-2xl leading-none">{k.icon}</span>
              <span className="text-[11px] font-semibold flex items-center gap-0.5 px-1.5 py-0.5 rounded-md"
                style={{ background: "rgba(255,255,255,.18)" }}>
                {k.trend === "up" && <TrendingUp size={11} />}
                {k.trend === "down" && <TrendingDown size={11} />}
                {k.trend === "flat" && <Minus size={11} />}
                {k.sub}
              </span>
            </div>
            <div className="mt-3 text-[26px] font-bold leading-none tabular-nums">{k.value}</div>
            <div className="mt-1.5 text-[12px] font-medium text-white/85">{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Row A: recent table | donut | quick info ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Recent table */}
        <div className={`xl:col-span-5 ${panel()}`} style={{ ...surf, ...border }}>
          <CardHead title="So'nggi zayavkalar"
            action={<Link href="/requests" className="text-[13px] font-medium flex items-center gap-1" style={{ color: "var(--brand)" }}>Barchasi <ArrowRight size={13} /></Link>} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ color: "var(--muted)" }}>
                  <th className="font-medium px-5 pb-2 text-[11px] uppercase tracking-wide">Zayavka</th>
                  <th className="font-medium pb-2 text-[11px] uppercase tracking-wide">Filial</th>
                  <th className="font-medium pb-2 text-[11px] uppercase tracking-wide">Sana</th>
                  <th className="font-medium pr-5 pb-2 text-[11px] uppercase tracking-wide text-right">Holat</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-t transition hover:bg-[var(--surface-2)]" style={border}>
                    <td className="px-5 py-2.5">
                      <Link href={`/requests/${r.id}`} className="block">
                        <div className="font-medium truncate max-w-[180px]">{r.title}</div>
                        <div className="text-[11px] font-mono" style={{ color: "var(--muted)" }}>{r.code}</div>
                      </Link>
                    </td>
                    <td className="py-2.5 text-[13px]" style={{ color: "var(--muted)" }}>{r.branch}</td>
                    <td className="py-2.5 text-[13px] tabular-nums" style={{ color: "var(--muted)" }}>{r.date}</td>
                    <td className="pr-5 py-2.5 text-right">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium"
                        style={{ background: `${BADGE_HEX[r.color] ?? "#94a3b8"}1f`, color: BADGE_HEX[r.color] ?? "#94a3b8" }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: BADGE_HEX[r.color] ?? "#94a3b8" }} />
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {recent.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-sm" style={{ color: "var(--muted)" }}>Zayavka yo&apos;q.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Donut */}
        <div className={`xl:col-span-4 ${panel()}`} style={{ ...surf, ...border }}>
          <CardHead title="Zayavkalar holati"
            action={bucket ? <button onClick={() => setBucket(null)} className="text-[12px]" style={{ color: "var(--brand)" }}>Tozalash</button> : null} />
          <Donut dist={data.statusDist} total={totalDist} active={bucket} onPick={setBucket} />
        </div>

        {/* Quick info */}
        <div className={`xl:col-span-3 ${panel()}`} style={{ ...surf, ...border }}>
          <CardHead title="Tezkor ma'lumotlar" />
          <div className="px-3 pb-4 space-y-0.5">
            {data.quickInfo.map((q, i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[var(--surface-2)] transition">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center text-[15px] shrink-0"
                  style={{ background: `${TONE[q.tone ?? "brand"]}1f` }}>{q.icon}</span>
                <span className="flex-1 text-[13px]" style={{ color: "var(--muted)" }}>{q.label}</span>
                <span className="font-semibold tabular-nums text-sm">{q.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row B: filial bars | dynamics | type dist ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className={`xl:col-span-4 ${panel()}`} style={{ ...surf, ...border }}>
          <CardHead title="Filiallar bo'yicha" />
          <div className="px-5 pb-5 space-y-3">
            {data.branchBars.map((b, i) => (
              <div key={i}>
                <div className="flex items-center justify-between text-[13px] mb-1">
                  <span className="truncate">{b.label}</span>
                  <span className="font-semibold tabular-nums">{b.value}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                  <div className="h-full rounded-full" style={{
                    width: `${Math.max((b.value / maxBar) * 100, b.value > 0 ? 6 : 0)}%`,
                    background: "linear-gradient(90deg,#2563eb,#60a5fa)", transition: "width .6s cubic-bezier(.16,1,.3,1)",
                  }} />
                </div>
              </div>
            ))}
            {data.branchBars.length === 0 && <div className="text-sm text-center py-4" style={{ color: "var(--muted)" }}>Ma&apos;lumot yo&apos;q.</div>}
          </div>
        </div>

        <div className={`xl:col-span-5 ${panel()}`} style={{ ...surf, ...border }}>
          <CardHead title="Zayavkalar dinamikasi (30 kun)"
            action={<RefreshCw size={14} style={{ color: "var(--muted)" }} />} />
          <Dynamics points={data.dynamics} />
        </div>

        <div className={`xl:col-span-3 ${panel()}`} style={{ ...surf, ...border }}>
          <CardHead title="Yo'nalish bo'yicha" />
          <div className="px-5 pb-5 space-y-3">
            {data.typeDist.map((t, i) => (
              <div key={i}>
                <div className="flex items-center justify-between text-[13px] mb-1">
                  <span className="truncate">{t.label}</span>
                  <span className="font-semibold tabular-nums" style={{ color: "var(--muted)" }}>{t.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                  <div className="h-full rounded-full" style={{ width: `${t.pct}%`, background: BAR_HUES[i % BAR_HUES.length], transition: "width .6s ease" }} />
                </div>
              </div>
            ))}
            {data.typeDist.length === 0 && <div className="text-sm text-center py-4" style={{ color: "var(--muted)" }}>Ma&apos;lumot yo&apos;q.</div>}
          </div>
        </div>
      </div>

      {/* ── Row C: reminders | activity ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className={`xl:col-span-8 ${panel()}`} style={{ ...surf, ...border }}>
          <CardHead title="Eslatma va bildirishnomalar" />
          <div className="px-5 pb-5 grid sm:grid-cols-3 gap-3">
            {data.reminders.map((r, i) => (
              <div key={i} className="rounded-xl border p-3.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                <div className="flex items-start gap-3">
                  <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${TONE[r.tone] ?? TONE.brand}22`, color: TONE[r.tone] ?? TONE.brand }}>
                    {r.icon === "bell" ? <Bell size={16} /> : <span className="text-[15px]">{r.icon}</span>}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold truncate">{r.title}</div>
                    <div className="text-[12px] mt-0.5" style={{ color: "var(--muted)" }}>{r.sub}</div>
                    <div className="text-[10px] mt-1" style={{ color: "var(--muted)" }}>{r.time}</div>
                  </div>
                </div>
              </div>
            ))}
            {data.reminders.length === 0 && <div className="text-sm py-4 sm:col-span-3 text-center" style={{ color: "var(--muted)" }}>Yangi bildirishnoma yo&apos;q ✅</div>}
          </div>
        </div>

        <div className={`xl:col-span-4 ${panel()}`} style={{ ...surf, ...border }}>
          <CardHead title="So'nggi faoliyatlar" />
          <div className="px-5 pb-5">
            <div className="relative pl-4">
              <div className="absolute left-[5px] top-1 bottom-1 w-px" style={{ background: "var(--border)" }} />
              {data.activity.map((a) => (
                <div key={a.id} className="relative pb-3.5 last:pb-0">
                  <span className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full ring-2"
                    style={{ background: TONE[a.tone] ?? TONE.brand, boxShadow: "0 0 0 2px var(--surface)" }} />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[13px] leading-snug">{a.text}</div>
                      <div className="text-[11px] font-mono mt-0.5" style={{ color: "var(--muted)" }}>{a.code}</div>
                    </div>
                    <span className="text-[11px] tabular-nums shrink-0" style={{ color: "var(--muted)" }}>{a.time}</span>
                  </div>
                </div>
              ))}
              {data.activity.length === 0 && <div className="text-sm py-4" style={{ color: "var(--muted)" }}>Faoliyat yo&apos;q.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const BAR_HUES = ["#2563eb", "#8b5cf6", "#06b6d4", "#f59e0b", "#22c55e", "#ef4444"];
