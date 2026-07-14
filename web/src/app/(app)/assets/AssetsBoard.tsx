"use client";

import { useState } from "react";
import { Eye, X, ArrowRightLeft, ClipboardCheck, Trash2, ImageIcon, FileText, CircleCheck, CircleDot, Download } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { LEVEL_META, type RiskResult } from "@/lib/risk/types";
import RiskCell from "@/components/risk/RiskCell";

export interface AssetHistory { kind: string; from: string | null; to: string | null; amount: number | null; note: string | null; who: string; at: string }
export interface AssetRow {
  id: number; inventoryNo: string; name: string; category: string; branch: string; branchId: number | null; location: string;
  assignee: string; purchaseDate: string; price: number; status: string; statusLabel: string; statusTone: string;
  photos: string[]; docs: string[]; serial: string; warranty: string; lastInventory: string; risk: RiskResult; history: AssetHistory[];
}
interface BranchOpt { id: number; name: string }
type Actions = { transfer: (fd: FormData) => Promise<void>; inventory: (fd: FormData) => Promise<void>; remove: (fd: FormData) => Promise<void> };

const TONE: Record<string, string> = { good: "#22c55e", attention: "#fbbf24", info: "#4f9bf5", critical: "#f87171", gray: "#8b949e" };
const KIND_LABEL: Record<string, string> = { transfer: "Ko'chirildi", repair: "Ta'mirlandi", inventory: "Inventarizatsiya", status: "Holat o'zgardi", note: "Izoh" };

export default function AssetsBoard({ assets, branches, actions }: { assets: AssetRow[]; branches: BranchOpt[]; actions: Actions }) {
  const [drill, setDrill] = useState<AssetRow | null>(null);
  if (assets.length === 0) {
    return <div className="rounded-2xl p-12 text-center text-sm" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}>Aktiv topilmadi.</div>;
  }
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs" style={{ color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
              <th className="font-medium px-4 py-3">Inventar #</th>
              <th className="font-medium px-3 py-3">Nomi</th>
              <th className="font-medium px-3 py-3 hidden lg:table-cell">Kategoriya</th>
              <th className="font-medium px-3 py-3 hidden md:table-cell">Filial</th>
              <th className="font-medium px-3 py-3 hidden xl:table-cell">Joylashuv</th>
              <th className="font-medium px-3 py-3 hidden xl:table-cell">Mas&apos;ul</th>
              <th className="font-medium px-3 py-3 text-right hidden lg:table-cell">Narx</th>
              <th className="font-medium px-3 py-3">Holat</th>
              <th className="font-medium px-3 py-3">AI</th>
              <th className="font-medium px-3 py-3 text-right pr-4">Amal</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="px-4 py-3 tabular-nums" style={{ color: "var(--muted)" }}>{a.inventoryNo}</td>
                <td className="px-3 py-3"><div className="font-medium">{a.name}</div><div className="text-[11px]" style={{ color: "var(--muted)" }}>{a.serial || "—"}</div></td>
                <td className="px-3 py-3 hidden lg:table-cell" style={{ color: "var(--muted)" }}>{a.category}</td>
                <td className="px-3 py-3 hidden md:table-cell whitespace-nowrap">{a.branch}</td>
                <td className="px-3 py-3 hidden xl:table-cell whitespace-nowrap" style={{ color: "var(--muted)" }}>{a.location}</td>
                <td className="px-3 py-3 hidden xl:table-cell whitespace-nowrap">{a.assignee}</td>
                <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap hidden lg:table-cell font-medium">{a.price ? formatMoney(a.price) : "—"}</td>
                <td className="px-3 py-3"><span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap" style={{ background: `${TONE[a.statusTone]}22`, color: TONE[a.statusTone] }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: TONE[a.statusTone] }} />{a.statusLabel}</span></td>
                <td className="px-3 py-3"><RiskCell subject={a.name} result={a.risk} /></td>
                <td className="px-3 py-3 pr-4 text-right"><button onClick={() => setDrill(a)} className="p-1.5 rounded-lg hover:bg-surface-2 transition" title="Ochish" aria-label="Ochish"><Eye size={16} style={{ color: "var(--muted)" }} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {drill && <AssetDrawer a={drill} branches={branches} actions={actions} onClose={() => setDrill(null)} />}
    </div>
  );
}

type Tab = "info" | "photos" | "docs" | "history" | "ai";
function AssetDrawer({ a, branches, actions, onClose }: { a: AssetRow; branches: BranchOpt[]; actions: Actions; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("info");
  const [showTransfer, setShowTransfer] = useState(false);
  const meta = LEVEL_META[a.risk.level];
  const TABS: { id: Tab; label: string }[] = [
    { id: "info", label: "Umumiy" }, { id: "photos", label: `Foto (${a.photos.length})` }, { id: "docs", label: `Hujjat (${a.docs.length})` }, { id: "history", label: `Tarix (${a.history.length})` }, { id: "ai", label: "AI" },
  ];
  return (
    <>
      <div className="fixed inset-0 z-40 animate-fade" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose} />
      <aside className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl flex flex-col animate-drawer" role="dialog" aria-modal="true" aria-label={a.name} style={{ background: "var(--surface)", borderLeft: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 h-14 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          <div className="min-w-0"><div className="font-semibold truncate">{a.name}</div><div className="text-xs" style={{ color: "var(--muted)" }}>{a.inventoryNo} · {a.statusLabel}</div></div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 shrink-0" aria-label="Yopish"><X size={18} /></button>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          <button onClick={() => setShowTransfer((v) => !v)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium" style={{ background: "var(--surface-2)" }}><ArrowRightLeft size={14} /> Transfer</button>
          <form action={actions.inventory}><input type="hidden" name="asset_id" value={a.id} /><button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium" style={{ background: "var(--surface-2)" }}><ClipboardCheck size={14} /> Inventarizatsiya</button></form>
          <form action={actions.remove} className="ml-auto"><input type="hidden" name="id" value={a.id} /><button className="p-1.5 rounded-lg hover:bg-surface-2" title="O'chirish" aria-label="O'chirish"><Trash2 size={15} style={{ color: "#f87171" }} /></button></form>
        </div>
        {showTransfer && (
          <form action={actions.transfer} className="flex flex-wrap items-end gap-2 px-4 py-3 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
            <input type="hidden" name="asset_id" value={a.id} />
            <select name="to_branch" required className="text-sm px-2.5 py-2 rounded-lg outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}>
              <option value="">— filialga —</option>
              {branches.filter((b) => b.id !== a.branchId).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <input name="reason" placeholder="Sabab" className="flex-1 min-w-[140px] text-sm px-3 py-2 rounded-lg outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }} />
            <button className="btn btn-brand !py-2 text-sm">O&apos;tkazish</button>
          </form>
        )}

        <div className="flex gap-1 px-4 pt-3 shrink-0 flex-wrap">
          {TABS.map((t) => <button key={t.id} onClick={() => setTab(t.id)} aria-pressed={tab === t.id} className="px-3 py-1.5 rounded-lg text-xs font-medium transition" style={tab === t.id ? { background: "var(--brand)", color: "var(--brand-fg)" } : { background: "var(--surface-2)", color: "var(--muted)" }}>{t.label}</button>)}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === "info" && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <F label="Inventar #" v={a.inventoryNo} /><F label="Seriya" v={a.serial} />
              <F label="Kategoriya" v={a.category} /><F label="Narx" v={a.price ? formatMoney(a.price) : "—"} />
              <F label="Filial" v={a.branch} /><F label="Joylashuv (xona)" v={a.location} />
              <F label="Mas'ul" v={a.assignee} /><F label="Holat" v={a.statusLabel} color={TONE[a.statusTone]} />
              <F label="Sotib olingan" v={a.purchaseDate} /><F label="Kafolat" v={a.warranty} />
              <F label="Oxirgi inventarizatsiya" v={a.lastInventory} /><F label="AI Risk" v={`${meta.dot} ${meta.label} · ${a.risk.score}/100`} color={meta.color} />
            </div>
          )}
          {tab === "photos" && (a.photos.length === 0 ? <Empty text="Foto yo'q." /> : (
            <div className="grid grid-cols-3 gap-2">{a.photos.map((p, i) => <div key={i} className="aspect-square rounded-xl flex flex-col items-center justify-center gap-1 text-[11px]" style={{ background: "var(--surface-2)", color: "var(--muted)" }}><ImageIcon size={22} /><span className="truncate max-w-full px-1">{p}</span></div>)}</div>
          ))}
          {tab === "docs" && (a.docs.length === 0 ? <Empty text="Hujjat yo'q." /> : (
            <div className="space-y-2">{a.docs.map((d, i) => <div key={i} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm" style={{ background: "var(--surface-2)" }}><FileText size={15} style={{ color: "var(--muted)" }} /><span className="flex-1 truncate">{d}</span><Download size={15} style={{ color: "var(--brand)" }} /></div>)}</div>
          ))}
          {tab === "history" && (a.history.length === 0 ? <Empty text="Tarix yo'q." /> : (
            <ol className="relative">{a.history.map((e, i) => { const last = i === a.history.length - 1; return (
              <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
                {!last && <span className="absolute left-[9px] top-6 bottom-0 w-px" style={{ background: "var(--border)" }} />}
                <span className="shrink-0 mt-0.5" style={{ color: last ? "var(--brand)" : "var(--muted)" }}>{last ? <CircleDot size={20} /> : <CircleCheck size={20} />}</span>
                <div className="min-w-0"><div className="text-sm font-medium">{KIND_LABEL[e.kind] ?? e.kind}{e.from && e.to ? `: ${e.from} → ${e.to}` : ""}{e.amount ? ` · ${formatMoney(e.amount)}` : ""}</div><div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{e.who} · {e.at}</div>{e.note && <div className="text-xs mt-1 rounded-lg px-2.5 py-1.5" style={{ background: "var(--surface-2)" }}>{e.note}</div>}</div>
              </li>); })}</ol>
          ))}
          {tab === "ai" && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0" style={{ background: `${meta.color}1f`, color: meta.color }}><span className="text-xl font-bold tabular-nums">{a.risk.score}</span><span className="text-[9px]">/ 100</span></div>
                <div><div className="text-xs" style={{ color: "var(--muted)" }}>Risk darajasi</div><div className="text-lg font-semibold" style={{ color: meta.color }}>{meta.dot} {meta.label}</div></div>
              </div>
              {a.risk.findings.length === 0 ? <div className="text-sm rounded-xl p-3" style={{ background: "var(--surface-2)" }}>Xavf aniqlanmadi ✅</div> : (
                <ul className="space-y-2">{a.risk.findings.map((f, i) => { const fm = LEVEL_META[f.level]; return (
                  <li key={i} className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: `${fm.color}22`, color: fm.color }}>{fm.dot} {f.title}</span><div className="text-xs mt-1.5" style={{ color: "var(--muted)" }}>{f.detail}</div></li>); })}</ul>
              )}
              <div><div className="text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>AI tavsiyasi</div><div className="text-sm leading-relaxed rounded-xl p-3" style={{ background: `${meta.color}12`, border: `1px solid ${meta.color}33` }}>{a.risk.recommendation}</div></div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function F({ label, v, color }: { label: string; v: string; color?: string }) {
  return <div><div className="text-[11px]" style={{ color: "var(--muted)" }}>{label}</div><div className="text-sm font-medium" style={color ? { color } : undefined}>{v || "—"}</div></div>;
}
function Empty({ text }: { text: string }) { return <div className="text-center py-8 text-sm" style={{ color: "var(--muted)" }}>{text}</div>; }
