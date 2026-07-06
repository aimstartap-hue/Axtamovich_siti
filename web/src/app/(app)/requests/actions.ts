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
