import { revalidatePath } from "next/cache";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Boxes, CheckCircle2, Wrench, HelpCircle, Archive, ClipboardList, Database } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/workflow";
import { logAudit } from "@/lib/audit";
import { evaluateAssetRisk } from "@/lib/risk/assets";
import RequestKpis, { type KpiItem } from "@/app/(app)/requests/RequestKpis";
import AssetFilters from "./AssetFilters";
import AssetsBoard, { type AssetRow, type AssetHistory } from "./AssetsBoard";

const PAGE_SIZE = 25;
const EXPENSIVE = 10_000_000;
const STALE_DAYS = 180;
const STATUS: Record<string, { label: string; tone: string }> = {
  active: { label: "Faol", tone: "good" }, repair: { label: "Ta'mirda", tone: "attention" },
  moved: { label: "Ko'chirilgan", tone: "info" }, lost: { label: "Yo'qolgan", tone: "critical" },
  written_off: { label: "Hisobdan chiqarilgan", tone: "gray" },
};

// ---- Server actions (audit + asset_events bilan) ----
async function transferAsset(fd: FormData) {
  "use server";
  const profile = await requireProfile();
  const sb = await createClient();
  const assetId = Number(fd.get("asset_id")), toBranch = Number(fd.get("to_branch")), reason = String(fd.get("reason") || "");
  if (!assetId || !toBranch) return;
  const { data: aRaw } = await sb.from("assets").select("branch_id, branch:branches(name)").eq("id", assetId).single();
  const { data: toBRaw } = await sb.from("branches").select("name").eq("id", toBranch).single();
  const a = aRaw as { branch: { name: string } | { name: string }[] | null } | null;
  const toName = (toBRaw as { name: string } | null)?.name ?? "—";
  const from = (Array.isArray(a?.branch) ? a?.branch[0]?.name : a?.branch?.name) ?? "—";
  await sb.from("assets").update({ branch_id: toBranch, status: "moved", updated_at: new Date().toISOString() }).eq("id", assetId);
  await sb.from("asset_events").insert({ org_id: profile.org_id, asset_id: assetId, kind: "transfer", from_ref: from, to_ref: toName, note: reason || null, actor_id: profile.id });
  await logAudit(sb, profile.org_id, profile.id, "asset_transfer", `Aktiv #${assetId}: ${from} → ${toName}${reason ? ` (${reason})` : ""}`);
  revalidatePath("/assets");
}
async function inventoryCheck(fd: FormData) {
  "use server";
  const profile = await requireProfile();
  const sb = await createClient();
  const assetId = Number(fd.get("asset_id")); if (!assetId) return;
  const nowIso = new Date().toISOString();
  await sb.from("assets").update({ last_inventory_at: nowIso, status: "active", updated_at: nowIso }).eq("id", assetId);
  await sb.from("asset_events").insert({ org_id: profile.org_id, asset_id: assetId, kind: "inventory", actor_id: profile.id });
  await logAudit(sb, profile.org_id, profile.id, "asset_inventory", `Aktiv #${assetId} inventarizatsiyadan o'tdi`);
  revalidatePath("/assets");
}
async function writeOffAsset(fd: FormData) {
  "use server";
  const profile = await requireProfile();
  const sb = await createClient();
  const assetId = Number(fd.get("id")); if (!assetId) return;
  await sb.from("assets").update({ status: "written_off", updated_at: new Date().toISOString() }).eq("id", assetId);
  await sb.from("asset_events").insert({ org_id: profile.org_id, asset_id: assetId, kind: "status", from_ref: "active", to_ref: "written_off", actor_id: profile.id });
  await logAudit(sb, profile.org_id, profile.id, "asset_writeoff", `Aktiv #${assetId} hisobdan chiqarildi`);
  revalidatePath("/assets");
}
async function addAsset(fd: FormData) {
  "use server";
  const profile = await requireProfile();
  const sb = await createClient();
  const name = String(fd.get("name") || "").trim(); if (!name) return;
  const inv = String(fd.get("inventory_no") || "").trim() || `AXO-${Date.now().toString(36).toUpperCase()}`;
  const { data: created } = await sb.from("assets").insert({
    org_id: profile.org_id, name, inventory_no: inv, category: String(fd.get("category") || "") || null,
    branch_id: fd.get("branch_id") ? Number(fd.get("branch_id")) : null, assignee_id: String(fd.get("assignee_id") || "") || null,
    location: String(fd.get("location") || "") || null, serial: String(fd.get("serial") || "") || null,
    price: fd.get("price") ? Number(fd.get("price")) : null, purchase_date: String(fd.get("purchase_date") || "") || null,
    warranty_until: String(fd.get("warranty_until") || "") || null, status: "active",
  }).select("id").single();
  await logAudit(sb, profile.org_id, profile.id, "asset_add", `Aktiv qo'shildi: ${name} (${inv})`);
  if (created) await sb.from("asset_events").insert({ org_id: profile.org_id, asset_id: created.id, kind: "note", note: "Aktiv yaratildi", actor_id: profile.id });
  revalidatePath("/assets");
}

type SP = Promise<{ q?: string; branch?: string; category?: string; assignee?: string; kpi?: string; from?: string; to?: string; pmin?: string; pmax?: string; page?: string }>;

export default async function AssetsPage({ searchParams }: { searchParams: SP }) {
  await requireProfile();
  const sb = await createClient();

  // Migratsiya 0010 qo'llanganmi? (yangi ustunlarni tekshiramiz) — bo'lmasa toza holat
  const probe = await sb.from("assets").select("id, status, inventory_no").limit(1);
  if (probe.error) return <MigrationNeeded />;

  const sp = await searchParams;
  const now = new Date();
  const page = Math.max(0, Number(sp.page) || 0);
  const staleIso = new Date(now.getTime() - STALE_DAYS * 86_400_000).toISOString();
  const invCond = `last_inventory_at.is.null,last_inventory_at.lt.${staleIso}`;
  const cols = "id, inventory_no, name, category, serial, branch_id, location, assignee_id, purchase_date, warranty_until, price, status, last_inventory_at, photos_json, docs_json, branch:branches(name)";

  // Bazaviy filtrlar (KPI facet'siz)
  const applyBase = <T,>(query: T): T => {
    let q = query as unknown as { or: (s: string) => unknown; eq: (c: string, v: unknown) => unknown; gte: (c: string, v: unknown) => unknown; lte: (c: string, v: unknown) => unknown };
    if (sp.q) q = q.or(`name.ilike.%${sp.q}%,inventory_no.ilike.%${sp.q}%,serial.ilike.%${sp.q}%`) as typeof q;
    if (sp.branch) q = q.eq("branch_id", Number(sp.branch)) as typeof q;
    if (sp.category) q = q.eq("category", sp.category) as typeof q;
    if (sp.assignee) q = q.eq("assignee_id", sp.assignee) as typeof q;
    if (sp.from) q = q.gte("purchase_date", sp.from) as typeof q;
    if (sp.to) q = q.lte("purchase_date", sp.to) as typeof q;
    if (sp.pmin) q = q.gte("price", Number(sp.pmin)) as typeof q;
    if (sp.pmax) q = q.lte("price", Number(sp.pmax)) as typeof q;
    return q as unknown as T;
  };
  const countS = (status?: string) => {
    let q = applyBase(sb.from("assets").select("id", { count: "exact", head: true }));
    if (status === "inventory") q = (q as unknown as { or: (s: string) => typeof q }).or(invCond);
    else if (status) q = (q as unknown as { eq: (c: string, v: unknown) => typeof q }).eq("status", status);
    return q.then((r) => r.count ?? 0);
  };

  // Jadval so'rovi (base + kpi facet + pagination)
  let listQ = applyBase(sb.from("assets").select(cols).order("id", { ascending: false }));
  const kpi = sp.kpi ?? "";
  if (kpi === "inventory") listQ = (listQ as unknown as { or: (s: string) => typeof listQ }).or(invCond);
  else if (kpi && STATUS[kpi]) listQ = (listQ as unknown as { eq: (c: string, v: unknown) => typeof listQ }).eq("status", kpi);
  const listCount = applyBase(sb.from("assets").select("id", { count: "exact", head: true }));
  if (kpi === "inventory") (listCount as unknown as { or: (s: string) => void }).or(invCond);
  else if (kpi && STATUS[kpi]) (listCount as unknown as { eq: (c: string, v: unknown) => void }).eq("status", kpi);

  const [total, nActive, nRepair, nLost, nOff, nInv, { data: rows, count: filtered }, { data: branches }, { data: people }, { data: catRows }] = await Promise.all([
    countS(), countS("active"), countS("repair"), countS("lost"), countS("written_off"), countS("inventory"),
    (listQ as unknown as { range: (a: number, b: number) => Promise<{ data: unknown[]; count: number | null }> }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1),
    sb.from("branches").select("id, name").order("name"),
    sb.from("profiles").select("id, full_name"),
    sb.from("assets").select("category").not("category", "is", null).limit(500),
  ]);

  const nameOf = new Map((people ?? []).map((u) => [u.id, u.full_name]));
  const branchOpts = ((branches ?? []) as { id: number; name: string }[]).map((b) => ({ id: b.id, name: b.name }));
  const categories = [...new Set(((catRows ?? []) as { category: string }[]).map((c) => c.category))].sort();
  const assignees = ((people ?? []) as { id: string; full_name: string }[]).map((u) => ({ id: u.id, name: u.full_name }));

  type Raw = { id: number; inventory_no: string | null; name: string; category: string | null; serial: string | null; branch_id: number | null; location: string | null; assignee_id: string | null; purchase_date: string | null; warranty_until: string | null; price: number | null; status: string; last_inventory_at: string | null; photos_json: string[] | null; docs_json: string[] | null; branch: { name: string } | { name: string }[] | null };
  const list = (rows ?? []) as unknown as Raw[];
  const pageIds = list.map((a) => a.id);

  const { data: evRows } = pageIds.length
    ? await sb.from("asset_events").select("asset_id, kind, from_ref, to_ref, amount, note, actor_id, created_at").in("asset_id", pageIds).order("created_at", { ascending: true })
    : { data: [] };
  const historyByAsset = new Map<number, AssetHistory[]>();
  const transferCount = new Map<number, number>();
  const repairTotal = new Map<number, number>();
  for (const e of (evRows ?? []) as { asset_id: number; kind: string; from_ref: string | null; to_ref: string | null; amount: number | null; note: string | null; actor_id: string | null; created_at: string }[]) {
    (historyByAsset.get(e.asset_id) ?? historyByAsset.set(e.asset_id, []).get(e.asset_id)!).push({ kind: e.kind, from: e.from_ref, to: e.to_ref, amount: e.amount, note: e.note, who: e.actor_id ? nameOf.get(e.actor_id) ?? "—" : "Tizim", at: formatDate(e.created_at) });
    if (e.kind === "transfer") transferCount.set(e.asset_id, (transferCount.get(e.asset_id) ?? 0) + 1);
    if (e.kind === "repair") repairTotal.set(e.asset_id, (repairTotal.get(e.asset_id) ?? 0) + (Number(e.amount) || 0));
  }

  const assets: AssetRow[] = list.map((a) => {
    const photos = Array.isArray(a.photos_json) ? a.photos_json : [];
    const docs = Array.isArray(a.docs_json) ? a.docs_json : [];
    const risk = evaluateAssetRisk({
      price: Number(a.price) || 0, hasPhoto: photos.length > 0, hasDocs: docs.length > 0, hasAssignee: !!a.assignee_id,
      lastInventoryAt: a.last_inventory_at, warrantyUntil: a.warranty_until, transferCount: transferCount.get(a.id) ?? 0,
      repairTotal: repairTotal.get(a.id) ?? 0, expensiveThreshold: EXPENSIVE, now,
    });
    const stat = STATUS[a.status] ?? { label: a.status, tone: "gray" };
    return {
      id: a.id, inventoryNo: a.inventory_no ?? `#${a.id}`, name: a.name, category: a.category ?? "—",
      branch: (Array.isArray(a.branch) ? a.branch[0]?.name : a.branch?.name) ?? "Umumiy", branchId: a.branch_id,
      location: a.location ?? "—", assignee: a.assignee_id ? nameOf.get(a.assignee_id) ?? "—" : "—",
      purchaseDate: a.purchase_date ? formatDate(a.purchase_date) : "—", price: Number(a.price) || 0,
      status: a.status, statusLabel: stat.label, statusTone: stat.tone, photos, docs, serial: a.serial ?? "",
      warranty: a.warranty_until ? formatDate(a.warranty_until) : "—", lastInventory: a.last_inventory_at ? formatDate(a.last_inventory_at) : "Hech qachon",
      risk, history: historyByAsset.get(a.id) ?? [],
    };
  });

  const kpis: KpiItem[] = [
    { icon: <Boxes size={16} />, label: "Jami aktivlar", value: String(total), sub: "barcha", accent: "#4f9bf5" },
    { icon: <CheckCircle2 size={16} />, label: "Faol", value: String(nActive), sub: "ishlatilmoqda", accent: "#22c55e", facet: "active" },
    { icon: <Wrench size={16} />, label: "Ta'mirda", value: String(nRepair), sub: "ta'mirda", accent: "#fbbf24", facet: "repair" },
    { icon: <HelpCircle size={16} />, label: "Yo'qolgan", value: String(nLost), sub: "yo'qolgan", accent: "#f87171", facet: "lost" },
    { icon: <Archive size={16} />, label: "Hisobdan chiqarilgan", value: String(nOff), sub: "chiqarilgan", accent: "#8b949e", facet: "written_off" },
    { icon: <ClipboardList size={16} />, label: "Inventarizatsiya kutilmoqda", value: String(nInv), sub: "tekshirilmagan", accent: "#fb923c", facet: "inventory" },
  ];

  const pageCount = Math.max(1, Math.ceil((filtered ?? 0) / PAGE_SIZE));
  const pageLink = (n: number) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(sp)) if (v && k !== "page") p.set(k, String(v)); if (n) p.set("page", String(n)); return `/assets?${p.toString()}`; };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Aktivlar</h1>
        <p className="text-xs" style={{ color: "var(--muted)" }}>Kompaniya moddiy boyliklari nazorati · AI risk · inventarizatsiya · transfer</p>
      </div>

      <details className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <summary className="cursor-pointer font-medium text-sm">+ Yangi aktiv qo&apos;shish</summary>
        <form action={addAsset} className="grid md:grid-cols-3 gap-2 mt-3">
          <input name="name" className="input" placeholder="Nomi *" required />
          <input name="inventory_no" className="input" placeholder="Inventar # (bo'sh — avto)" />
          <input name="category" className="input" placeholder="Kategoriya" />
          <select name="branch_id" className="select"><option value="">— filial —</option>{branchOpts.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <select name="assignee_id" className="select"><option value="">— mas&apos;ul —</option>{assignees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
          <input name="location" className="input" placeholder="Joylashuv (xona)" />
          <input name="serial" className="input" placeholder="Seriya raqami" />
          <input name="price" type="number" className="input" placeholder="Narxi" />
          <input name="purchase_date" type="date" className="input" />
          <input name="warranty_until" type="date" className="input" />
          <button className="btn btn-brand md:col-span-3">Qo&apos;shish</button>
        </form>
      </details>

      <AssetFilters branches={branchOpts} categories={categories} assignees={assignees} />
      <RequestKpis items={kpis} />
      <AssetsBoard assets={assets} branches={branchOpts} actions={{ transfer: transferAsset, inventory: inventoryCheck, remove: writeOffAsset }} />

      {(filtered ?? 0) > PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs" style={{ color: "var(--muted)" }}>
          <span>Jami {filtered} · sahifa {page + 1} / {pageCount}</span>
          <div className="flex items-center gap-1">
            {page > 0 && <Link href={pageLink(page - 1)} className="p-1.5 rounded-lg hover:bg-surface-2" aria-label="Oldingi"><ChevronLeft size={16} /></Link>}
            {page < pageCount - 1 && <Link href={pageLink(page + 1)} className="p-1.5 rounded-lg hover:bg-surface-2" aria-label="Keyingi"><ChevronRight size={16} /></Link>}
          </div>
        </div>
      )}
    </div>
  );
}

// Migratsiya 0010 hali qo'llanmagan — toza, amaliy holat (500 xato o'rniga)
function MigrationNeeded() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Aktivlar</h1>
        <p className="text-xs" style={{ color: "var(--muted)" }}>Kompaniya moddiy boyliklari nazorati · AI risk · inventarizatsiya · transfer</p>
      </div>
      <div className="rounded-2xl p-8 flex flex-col items-center text-center gap-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <Database size={40} style={{ color: "#fb923c" }} />
        <div className="text-sm font-medium">Modul deyarli tayyor — bir qadam qoldi</div>
        <div className="text-xs max-w-md" style={{ color: "var(--muted)" }}>
          Aktivlar moduli yangi ustunlar va <b>asset_events</b> jadvalini talab qiladi. Supabase SQL editorда
          <b> web/supabase/migrations/0010_assets.sql</b> faylini ishga tushiring — so&apos;ng bu sahifa avtomatik to&apos;liq ishlaydi.
        </div>
        <code className="text-[11px] rounded-lg px-3 py-2 mt-1" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>supabase/migrations/0010_assets.sql</code>
      </div>
    </div>
  );
}
