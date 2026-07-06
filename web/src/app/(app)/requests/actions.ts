"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import {
  canApprove, nextStatusOnApprove, setsDeadlineOnApprove, setsLimitOnApprove,
  setsEstimateOnApprove, canRequestDeadlineChange, canResolveDispute,
  canSubmitReport, canReopen, canSendToHr, canHrResolve, startStatus, NOTIFY_ROLES,
  canDelegateToManager, canAxoReview,
} from "@/lib/workflow";
import { DEFAULT_CEO_THRESHOLD, type Role } from "@/lib/constants";
import type { RequestRow } from "@/lib/types";

type SB = Awaited<ReturnType<typeof createClient>>;

/** Shu org da berilgan rollarga ega foydalanuvchilarga bildirishnoma. */
async function notifyRoles(sb: SB, orgId: string, roles: Role[], requestId: number, text: string) {
  if (!roles.length) return;
  const { data: users } = await sb.from("profiles").select("id").eq("org_id", orgId).in("role", roles);
  if (!users?.length) return;
  await sb.from("notifications").insert(
    users.map((u) => ({ org_id: orgId, user_id: u.id, request_id: requestId, text })),
  );
}

async function logEvent(sb: SB, orgId: string, requestId: number, userId: string, action: string, comment?: string) {
  await sb.from("events").insert({ org_id: orgId, request_id: requestId, user_id: userId, action, comment: comment ?? null });
}

async function getThreshold(sb: SB, orgId: string): Promise<number> {
  const { data } = await sb.from("org_settings").select("value").eq("org_id", orgId).eq("key", "ceo_threshold").single();
  const v = data?.value ? parseFloat(data.value) : NaN;
  return isNaN(v) ? DEFAULT_CEO_THRESHOLD : v;
}

// --- YARATISH ---------------------------------------------------------------
export async function createRequestAction(_prev: unknown, formData: FormData) {
  const profile = await getProfile();
  if (!profile?.org_id) return { error: "Avtorizatsiya kerak" };
  const sb = await createClient();

  const type = String(formData.get("type") || "maintenance");
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const branchId = formData.get("branch_id") ? Number(formData.get("branch_id")) : null;
  const priority = String(formData.get("priority") || "normal");
  const photos = JSON.parse(String(formData.get("photos_json") || "[]"));

  if (!title) return { error: "Sarlavhani kiriting." };
  if (type === "maintenance" && !branchId) return { error: "Filialni tanlang." };

  const base = {
    org_id: profile.org_id, type, title, description, branch_id: branchId,
    created_by: profile.id, status: startStatus(), photos_json: photos,
  };
  let { data, error } = await sb.from("requests").insert({ ...base, priority }).select("id").single();
  // Agar 'priority' ustuni hali qo'shilmagan bo'lsa (0005 migratsiya) — ustunsiz qayta urinish
  if (error && /priority/i.test(error.message)) {
    ({ data, error } = await sb.from("requests").insert(base).select("id").single());
  }
  if (error) return { error: error.message };
  if (!data) return { error: "Zayavka yaratilmadi." };

  await logEvent(sb, profile.org_id, data.id, profile.id, "Zayavka yaratildi");
  await notifyRoles(sb, profile.org_id, NOTIFY_ROLES["pending_axo"], data.id, `Yangi zayavka: ${title}`);
  revalidatePath("/requests");
  redirect(`/requests/${data.id}`);
}

// --- Zayavkani olish + huquq ---
async function loadReq(sb: SB, id: number): Promise<RequestRow | null> {
  const { data } = await sb.from("requests").select("*").eq("id", id).single();
  return (data as RequestRow) ?? null;
}

// --- TASDIQLASH -------------------------------------------------------------
export async function approveAction(formData: FormData) {
  const profile = await getProfile();
  if (!profile?.org_id) return;
  const sb = await createClient();
  const id = Number(formData.get("id"));
  const r = await loadReq(sb, id);
  if (!r || !canApprove(r, profile.role)) return;

  const patch: Record<string, unknown> = {};
  let amount: number | null = r.estimated_amount;

  // AXO summa kiritadi
  if (setsEstimateOnApprove(r)) {
    const est = formData.get("estimated_amount");
    amount = est ? Number(est) : null;
    patch.estimated_amount = amount;
    patch.estimated_category = String(formData.get("estimated_category") || "") || null;
  }
  // CEO muddat belgilaydi
  if (setsDeadlineOnApprove(r)) {
    const dl = String(formData.get("deadline") || "");
    if (dl) { patch.deadline = dl; patch.deadline_confirmed = true; }
  }
  // Moliya limit qo'yadi
  if (setsLimitOnApprove(r)) {
    const lim = formData.get("limit_amount");
    if (lim) patch.limit_amount = Number(lim);
    patch.limit_type = String(formData.get("limit_type") || "soft");
  }

  const threshold = await getThreshold(sb, r.org_id);
  const next = nextStatusOnApprove(r, amount, threshold);
  patch.status = next;

  await sb.from("requests").update(patch).eq("id", id);
  await logEvent(sb, r.org_id, id, profile.id, "Tasdiqladi", String(formData.get("comment") || "") || undefined);
  await notifyRoles(sb, r.org_id, NOTIFY_ROLES[next] ?? [], id, `Zayavka #${id}: ${r.title}`);
  revalidatePath(`/requests/${id}`);
  revalidatePath("/requests");
}

// --- RAD ETISH --------------------------------------------------------------
export async function rejectAction(formData: FormData) {
  const profile = await getProfile();
  if (!profile?.org_id) return;
  const sb = await createClient();
  const id = Number(formData.get("id"));
  const r = await loadReq(sb, id);
  if (!r) return;
  // Faqat tasdiqlash bosqichidagilar rad eta oladi
  if (!canApprove(r, profile.role) && !["ceo", "admin"].includes(profile.role)) return;

  await sb.from("requests").update({ status: "rejected", rejected_by: profile.id }).eq("id", id);
  await logEvent(sb, r.org_id, id, profile.id, "Rad etdi", String(formData.get("comment") || "") || undefined);
  await sb.from("notifications").insert({
    org_id: r.org_id, user_id: r.created_by, request_id: id, text: `Zayavka #${id} rad etildi`,
  });
  revalidatePath(`/requests/${id}`);
}

// --- QAYTA OCHISH -----------------------------------------------------------
export async function reopenAction(formData: FormData) {
  const profile = await getProfile();
  if (!profile?.org_id) return;
  const sb = await createClient();
  const id = Number(formData.get("id"));
  const r = await loadReq(sb, id);
  if (!r || !canReopen(r, profile)) return;
  await sb.from("requests").update({ status: "pending_axo", rejected_by: null }).eq("id", id);
  await logEvent(sb, r.org_id, id, profile.id, "Qayta ochildi");
  await notifyRoles(sb, r.org_id, NOTIFY_ROLES["pending_axo"], id, `Zayavka #${id} qayta ochildi`);
  revalidatePath(`/requests/${id}`);
}

// --- HR ga yo'naltirish ------------------------------------------------------
export async function sendToHrAction(formData: FormData) {
  const profile = await getProfile();
  if (!profile?.org_id) return;
  const sb = await createClient();
  const id = Number(formData.get("id"));
  const r = await loadReq(sb, id);
  if (!r || !canSendToHr(r, profile)) return;
  await sb.from("requests").update({ status: "hr_review" }).eq("id", id);
  await logEvent(sb, r.org_id, id, profile.id, "HR ga yo'naltirildi (oylikdan kesish)");
  await notifyRoles(sb, r.org_id, NOTIFY_ROLES["hr_review"], id, `HR ko'rib chiqishi kerak: #${id}`);
  revalidatePath(`/requests/${id}`);
}

export async function hrResolveAction(formData: FormData) {
  const profile = await getProfile();
  if (!profile?.org_id) return;
  const sb = await createClient();
  const id = Number(formData.get("id"));
  const r = await loadReq(sb, id);
  if (!r || !canHrResolve(r, profile.role)) return;
  await sb.from("requests").update({ status: "closed" }).eq("id", id);
  await logEvent(sb, r.org_id, id, profile.id, "HR yopdi", String(formData.get("comment") || "") || undefined);
  revalidatePath(`/requests/${id}`);
}

// --- Muddat nizosi (Moliya so'raydi -> CEO hal qiladi) ----------------------
export async function requestDeadlineChangeAction(formData: FormData) {
  const profile = await getProfile();
  if (!profile?.org_id) return;
  const sb = await createClient();
  const id = Number(formData.get("id"));
  const r = await loadReq(sb, id);
  if (!r || !canRequestDeadlineChange(r, profile.role)) return;
  const suggested = String(formData.get("suggested_deadline") || "");
  await sb.from("requests").update({
    status: "deadline_dispute", deadline_disputed: true, suggested_deadline: suggested || null,
  }).eq("id", id);
  await logEvent(sb, r.org_id, id, profile.id, "Muddatni o'zgartirishni so'radi", suggested);
  await notifyRoles(sb, r.org_id, NOTIFY_ROLES["deadline_dispute"], id, `Muddat nizosi: #${id}`);
  revalidatePath(`/requests/${id}`);
}

export async function resolveDisputeAction(formData: FormData) {
  const profile = await getProfile();
  if (!profile?.org_id) return;
  const sb = await createClient();
  const id = Number(formData.get("id"));
  const r = await loadReq(sb, id);
  if (!r || !canResolveDispute(r, profile.role)) return;
  const dl = String(formData.get("deadline") || "");
  await sb.from("requests").update({
    status: "pending_finance", deadline: dl || r.deadline, deadline_confirmed: true,
  }).eq("id", id);
  await logEvent(sb, r.org_id, id, profile.id, "Muddat nizosini hal qildi", dl);
  await notifyRoles(sb, r.org_id, NOTIFY_ROLES["pending_finance"], id, `Zayavka #${id} Moliyaga qaytdi`);
  revalidatePath(`/requests/${id}`);
}

// --- HISOBOT ----------------------------------------------------------------
export async function submitReportAction(formData: FormData) {
  const profile = await getProfile();
  if (!profile?.org_id) return { error: "Avtorizatsiya kerak" };
  const sb = await createClient();
  const id = Number(formData.get("id"));
  const r = await loadReq(sb, id);
  if (!r || !canSubmitReport(r, profile.role)) return { error: "Ruxsat yo'q" };

  const note = String(formData.get("note") || "");
  const items = JSON.parse(String(formData.get("items_json") || "[]")) as
    { name: string; category: string | null; supplier: string | null; qty: number; price: number }[];
  const photos = JSON.parse(String(formData.get("photos_json") || "[]"));
  // Yaxlitlik (punkt 9): jami har doim serverда itemlardan qayta hisoblanadi —
  // mijoz yuborgan songa ishonilmaydi.
  const total = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);

  // Qat'iy (hard) limit majburlanadi (punkt 2): hisobot limitdan oshsa — bloklanadi.
  if (r.limit_type === "hard" && r.limit_amount != null && total > Number(r.limit_amount)) {
    const over = total - Number(r.limit_amount);
    return {
      error: `Qat'iy limitdan oshib ketdi: hisobot ${total.toLocaleString("ru-RU")} so'm, limit ${Number(r.limit_amount).toLocaleString("ru-RU")} so'm (${over.toLocaleString("ru-RU")} so'm ortiq). Moliya bilan bog'laning.`,
    };
  }

  const { data: rep, error } = await sb.from("reports").insert({
    org_id: r.org_id, request_id: id, note, total, photos_json: photos, submitted_by: profile.id,
  }).select("id").single();
  if (error) return { error: error.message };

  if (items.length) {
    await sb.from("report_items").insert(
      items.map((it) => ({
        org_id: r.org_id, report_id: rep.id, name: it.name, category: it.category,
        supplier: it.supplier, qty: it.qty, price: it.price,
      })),
    );
  }
  // Menejer bajargan bo'lsa -> avval AXO tekshiruvi; aks holda to'g'ridan Moliya/CEO
  const delegated = r.status === "manager_doing";
  const nextStatus = delegated ? "axo_review" : "report_submitted";
  const patch: Record<string, unknown> = { status: nextStatus };
  if (r.type === "maintenance") patch.executed_by = profile.role === "branch_manager" ? "manager" : "axo";
  await sb.from("requests").update(patch).eq("id", id);
  await logEvent(sb, r.org_id, id, profile.id, "Hisobot topshirildi");
  await notifyRoles(sb, r.org_id, NOTIFY_ROLES[nextStatus] ?? [], id, `Hisobot topshirildi: #${id}`);

  // Byudjet ogohlantirishi (punkt 13): filial byudjeti 80%/100% dan oshsa moliyaga xabar.
  if (r.branch_id) {
    const month = new Date().toISOString().slice(0, 7);
    const [{ data: bud }, { data: reps }, { data: br }] = await Promise.all([
      sb.from("budgets").select("amount").eq("branch_id", r.branch_id).eq("month", month).maybeSingle(),
      sb.from("reports").select("total, created_at, request:requests(branch_id)"),
      sb.from("branches").select("name").eq("id", r.branch_id).maybeSingle(),
    ]);
    const budget = Number(bud?.amount ?? 0);
    if (budget > 0) {
      const spent = (reps ?? []).reduce((s, x) => {
        const rr = x as unknown as { total: number; created_at: string; request: { branch_id: number } | null };
        return rr.request?.branch_id === r.branch_id && rr.created_at?.startsWith(month) ? s + (rr.total || 0) : s;
      }, 0);
      const ratio = spent / budget;
      const name = (br as { name?: string } | null)?.name ?? `#${r.branch_id}`;
      if (ratio >= 1) {
        await notifyRoles(sb, r.org_id, ["finance", "ops_director"], id, `⚠️ ${name} filial byudjeti oshib ketdi (${Math.round(ratio * 100)}%)`);
      } else if (ratio >= 0.8) {
        await notifyRoles(sb, r.org_id, ["finance", "ops_director"], id, `${name} filial byudjeti ${Math.round(ratio * 100)}% ga yetdi`);
      }
    }
  }

  // Ochilish (new_branch): smetadan oshsa ogohlantirish (O-20) + jihozlarni aktivga (O-15)
  if (r.type === "new_branch") {
    if (r.estimated_amount != null && total > Number(r.estimated_amount)) {
      const over = total - Number(r.estimated_amount);
      await notifyRoles(sb, r.org_id, ["open_group", "finance", "ceo"], id,
        `⚠️ "${r.title}" ochilishi smetadan ${over.toLocaleString("ru-RU")} so'm oshdi`);
    }
    const assetRows = items
      .filter((it) => it.name?.trim() && (Number(it.price) || 0) >= 500_000)
      .map((it) => ({
        org_id: r.org_id, branch_id: null, name: it.name, category: it.category,
        purchase_date: new Date().toISOString().slice(0, 10), note: `Ochilish: ${r.title}`,
      }));
    if (assetRows.length) await sb.from("assets").insert(assetRows);
  }

  revalidatePath(`/requests/${id}`);
  return { ok: true };
}

// --- AXO: zayavkani menejerga topshirish (o'zi qilish o'rniga) ---------------
export async function delegateToManagerAction(formData: FormData) {
  const profile = await getProfile();
  if (!profile?.org_id) return;
  const sb = await createClient();
  const id = Number(formData.get("id"));
  const r = await loadReq(sb, id);
  if (!r || !canDelegateToManager(r, profile.role)) return;
  await sb.from("requests").update({ status: "manager_doing", executed_by: "manager" }).eq("id", id);
  await logEvent(sb, r.org_id, id, profile.id, "Menejerga topshirildi (o'zi bajaradi)", String(formData.get("comment") || "") || undefined);
  // Filial menejeriga xabar
  await sb.from("notifications").insert({
    org_id: r.org_id, user_id: r.created_by, request_id: id,
    text: `Zayavka #${id} sizga topshirildi — bajarib hisobot bering`,
  });
  await notifyRoles(sb, r.org_id, NOTIFY_ROLES["manager_doing"], id, `Sizga topshirildi: #${id}`);
  revalidatePath(`/requests/${id}`);
}

// --- AXO: menejer hisobotini tekshirib Moliyaga uzatish ---------------------
export async function axoReviewAction(formData: FormData) {
  const profile = await getProfile();
  if (!profile?.org_id) return;
  const sb = await createClient();
  const id = Number(formData.get("id"));
  const r = await loadReq(sb, id);
  if (!r || !canAxoReview(r, profile.role)) return;
  await sb.from("requests").update({ status: "report_submitted" }).eq("id", id);
  await logEvent(sb, r.org_id, id, profile.id, "AXO tekshirdi → Moliyaga uzatildi");
  await notifyRoles(sb, r.org_id, NOTIFY_ROLES["report_submitted"], id, `Hisobot Moliyaga: #${id}`);
  revalidatePath(`/requests/${id}`);
}

// --- Menejer: yopilgan zayavkaga baho (1-5) ---------------------------------
export async function rateRequestAction(formData: FormData) {
  const profile = await getProfile();
  if (!profile?.org_id) return;
  const sb = await createClient();
  const id = Number(formData.get("id"));
  const rating = Number(formData.get("rating"));
  const r = await loadReq(sb, id);
  if (!r || r.status !== "closed" || r.created_by !== profile.id) return;
  if (rating < 1 || rating > 5) return;
  await sb.from("requests").update({ rating }).eq("id", id);
  revalidatePath(`/requests/${id}`);
}

// --- To'lov holati (moliya belgilaydi) (punkt 16) --------------------------
export async function markPaidAction(formData: FormData) {
  const profile = await getProfile();
  if (!profile?.org_id) return;
  if (!["finance", "admin", "ops_director", "ceo"].includes(profile.role)) return;
  const sb = await createClient();
  const id = Number(formData.get("id"));
  const paid = formData.get("paid") === "1";
  await sb.from("requests").update({ paid, paid_at: paid ? new Date().toISOString() : null }).eq("id", id);
  const r = await loadReq(sb, id);
  if (r) await logEvent(sb, r.org_id, id, profile.id, paid ? "To'langan deb belgilandi" : "To'lov bekor qilindi");
  revalidatePath(`/requests/${id}`);
  revalidatePath("/requests");
}

// --- Ochilishni yakunlash: filial yaratish + 1-oy byudjeti + topshirish (O-16, O-24) ---
export async function completeOpeningAction(formData: FormData) {
  const profile = await getProfile();
  if (!profile?.org_id) return;
  if (!["open_group", "admin", "ops_director"].includes(profile.role)) return;
  const sb = await createClient();
  const id = Number(formData.get("id"));
  const r = await loadReq(sb, id);
  if (!r || r.type !== "new_branch" || r.status !== "closed") return;
  const name = String(formData.get("branch_name") || "").trim();
  if (!name) return;
  const budget = Number(String(formData.get("budget") || "0").replace(/[^\d]/g, ""));

  const { data: br } = await sb.from("branches").insert({ org_id: profile.org_id, name, status: "active" }).select("id").single();
  if (!br) return;
  // Ochilish jihozlarini (aktivlarni) yangi filialga bog'lash
  await sb.from("assets").update({ branch_id: br.id }).eq("org_id", profile.org_id).is("branch_id", null).eq("note", `Ochilish: ${r.title}`);
  // 1-oy byudjeti
  if (budget > 0) {
    const month = new Date().toISOString().slice(0, 7);
    await sb.from("budgets").upsert(
      { org_id: profile.org_id, branch_id: br.id, month, category: "", amount: budget }, { onConflict: "branch_id,month,category" });
  }
  await logEvent(sb, r.org_id, id, profile.id, `Filial "${name}" faollashtirildi va topshirildi`);
  revalidatePath(`/requests/${id}`);
  revalidatePath("/openings");
  revalidatePath("/budgets");
}

// --- Ochilish bosqichlari / loyiha / kategoriya byudjeti (O-11, O-12, O-1) ---
function canManageOpening(role: string) {
  return ["open_group", "admin", "ops_director"].includes(role);
}

export async function toggleOpeningStageAction(formData: FormData) {
  const profile = await getProfile();
  if (!profile?.org_id || !canManageOpening(profile.role)) return;
  const sb = await createClient();
  const id = Number(formData.get("id"));
  const r = await loadReq(sb, id);
  if (!r || r.type !== "new_branch") return;
  const stages = { ...(r.opening_stages ?? {}) };
  stages[String(formData.get("stage"))] = formData.get("done") === "1";
  await sb.from("requests").update({ opening_stages: stages }).eq("id", id);
  revalidatePath(`/requests/${id}`);
  revalidatePath("/openings");
}

export async function setOpeningProjectAction(formData: FormData) {
  const profile = await getProfile();
  if (!profile?.org_id || !canManageOpening(profile.role)) return;
  const sb = await createClient();
  const id = Number(formData.get("id"));
  const r = await loadReq(sb, id);
  if (!r || r.type !== "new_branch") return;
  const project = String(formData.get("opening_project") || "").trim() || null;
  await sb.from("requests").update({ opening_project: project }).eq("id", id);
  revalidatePath(`/requests/${id}`);
  revalidatePath("/openings");
}

export async function saveOpeningBudgetAction(formData: FormData) {
  const profile = await getProfile();
  if (!profile?.org_id || !canManageOpening(profile.role)) return;
  const sb = await createClient();
  const id = Number(formData.get("id"));
  const r = await loadReq(sb, id);
  if (!r || r.type !== "new_branch") return;
  const category = String(formData.get("category") || "").trim();
  if (!category) return;
  const amount = Number(String(formData.get("amount") || "0").replace(/[^\d]/g, ""));
  const b = { ...(r.opening_budget ?? {}) };
  if (amount > 0) b[category] = amount; else delete b[category];
  await sb.from("requests").update({ opening_budget: b }).eq("id", id);
  revalidatePath(`/requests/${id}`);
}

// --- Zayavkani takrorlash (o'sha muammo yana bo'ldi) ------------------------
export async function duplicateRequestAction(formData: FormData) {
  const profile = await getProfile();
  if (!profile?.org_id) return;
  const sb = await createClient();
  const id = Number(formData.get("id"));
  const r = await loadReq(sb, id);
  if (!r) return;
  const { data } = await sb.from("requests").insert({
    org_id: profile.org_id, type: r.type, title: r.title, description: r.description,
    branch_id: r.branch_id, created_by: profile.id, status: startStatus(),
    priority: r.priority ?? "normal", photos_json: [],
  }).select("id").single();
  if (!data) return;
  await logEvent(sb, r.org_id, data.id, profile.id, `#${id} asosida takrorlandi`);
  await notifyRoles(sb, r.org_id, NOTIFY_ROLES["pending_axo"], data.id, `Takroriy zayavka: ${r.title}`);
  revalidatePath("/requests");
  redirect(`/requests/${data.id}`);
}

// --- IZOH -------------------------------------------------------------------
export async function addCommentAction(formData: FormData) {
  const profile = await getProfile();
  if (!profile?.org_id) return;
  const sb = await createClient();
  const id = Number(formData.get("id"));
  const text = String(formData.get("text") || "").trim();
  if (!text) return;
  await sb.from("comments").insert({ org_id: profile.org_id, request_id: id, user_id: profile.id, text });
  revalidatePath(`/requests/${id}`);
}
