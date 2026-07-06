"use client";

import { useState } from "react";
import Link from "next/link";
import NumberInput from "@/components/NumberInput";
import { formatMoney } from "@/lib/format";
import { EXPENSE_GROUPS, TYPE_GROUPS } from "@/lib/constants";
import {
  canApprove, canSubmitReport, canResolveDispute, canRequestDeadlineChange,
  canReopen, canSendToHr, canHrResolve, setsEstimateOnApprove, setsDeadlineOnApprove,
  setsLimitOnApprove, canDelegateToManager, canAxoReview,
} from "@/lib/workflow";
import type { RequestRow, Profile } from "@/lib/types";
import {
  approveAction, rejectAction, reopenAction, sendToHrAction, hrResolveAction,
  requestDeadlineChangeAction, resolveDisputeAction, delegateToManagerAction, axoReviewAction,
} from "../actions";

/** Byudjet konteksti — moliya tasdiqlaganда qoldiqni ko'rsatadi (punkt 1). */
function BudgetBox({ budget, adding }: { budget: BudgetInfo; adding: number }) {
  const remaining = budget.amount - budget.spent - budget.committed;
  const afterThis = remaining - (adding || 0);
  if (budget.amount <= 0) {
    return (
      <div className="text-xs bg-surface-2 rounded-lg px-3 py-2 text-muted">
        Bu filialga joriy oyга byudjet belgilanmagan.
      </div>
    );
  }
  return (
    <div className="text-xs bg-surface-2 rounded-lg px-3 py-2 space-y-0.5">
      <div className="flex justify-between"><span className="text-muted">Oylik byudjet</span><span className="font-medium">{formatMoney(budget.amount)}</span></div>
      <div className="flex justify-between"><span className="text-muted">Sarflandi</span><span>{formatMoney(budget.spent)}</span></div>
      <div className="flex justify-between"><span className="text-muted">Majburiyat (tasdiqlangan)</span><span>{formatMoney(budget.committed)}</span></div>
      <div className="flex justify-between border-t border-border pt-0.5 mt-0.5">
        <span className="text-muted">Qoldiq</span>
        <span className={remaining < 0 ? "text-danger font-semibold" : "font-semibold"}>{formatMoney(remaining)}</span>
      </div>
      {adding > 0 && (
        <div className={`flex justify-between ${afterThis < 0 ? "text-danger font-semibold" : "text-muted"}`}>
          <span>Bu zayavkadan keyin</span><span>{formatMoney(afterThis)}{afterThis < 0 ? " ⚠️" : ""}</span>
        </div>
      )}
    </div>
  );
}

function CategorySelect({ type, name }: { type: string; name: string }) {
  const groups = TYPE_GROUPS[type] ?? Object.keys(EXPENSE_GROUPS);
  return (
    <select name={name} className="select">
      <option value="">— kategoriya —</option>
      {groups.map((g) => (
        <optgroup key={g} label={g}>
          {EXPENSE_GROUPS[g]?.map((c) => <option key={c} value={c}>{c}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

export interface BudgetInfo { amount: number; spent: number; committed: number; }

export default function ActionPanel({ req, profile, budget }: { req: RequestRow; profile: Profile; budget?: BudgetInfo | null }) {
  const role = profile.role;
  const [est, setEst] = useState<number | null>(req.estimated_amount ?? null);
  const [lim, setLim] = useState<number | null>(null);
  const showApprove = canApprove(req, role);
  const showDispute = canResolveDispute(req, role);
  const showReopen = canReopen(req, profile);
  const showHr = canSendToHr(req, profile);
  const showHrResolve = canHrResolve(req, role);
  const showReport = canSubmitReport(req, role);
  const canAskDeadline = canRequestDeadlineChange(req, role);
  const showDelegate = canDelegateToManager(req, role);
  const showAxoReview = canAxoReview(req, role);

  const anything = showApprove || showDispute || showReopen || showHr || showHrResolve || showReport || showDelegate || showAxoReview;
  if (!anything) return null;

  return (
    <div className="card p-5 space-y-4 border-brand/40">
      <h2 className="font-semibold">Amallar</h2>

      {/* TASDIQLASH */}
      {showApprove && (
        <form action={approveAction} className="space-y-3">
          <input type="hidden" name="id" value={req.id} />

          {setsEstimateOnApprove(req) && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Taxminiy summa (so'm)</label>
                <NumberInput name="estimated_amount" value={est} onValueChange={setEst} placeholder="0" />
              </div>
              <div>
                <label className="label">Kategoriya</label>
                <CategorySelect type={req.type} name="estimated_category" />
              </div>
            </div>
          )}

          {setsDeadlineOnApprove(req) && (
            <div>
              <label className="label">Muddat (sana)</label>
              <input name="deadline" type="date" className="input" />
            </div>
          )}

          {budget && (
            <BudgetBox budget={budget} adding={est ?? req.estimated_amount ?? 0} />
          )}

          {setsLimitOnApprove(req) && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">AXO limiti (so'm)</label>
                <NumberInput name="limit_amount" value={lim} onValueChange={setLim} placeholder="0" />
              </div>
              <div>
                <label className="label">Limit turi</label>
                <select name="limit_type" className="select">
                  <option value="soft">Yumshoq (ogohlantiradi)</option>
                  <option value="hard">Qat'iy (bloklaydi)</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button className="btn btn-success" formAction={approveAction}>✓ Tasdiqlash</button>
            <button className="btn btn-danger" formAction={rejectAction}>✕ Rad etish</button>
          </div>

          {canAskDeadline && (
            <details className="text-sm">
              <summary className="cursor-pointer text-brand">Muddatni o'zgartirishni so'rash</summary>
              <div className="mt-2 flex gap-2">
                <input name="suggested_deadline" type="date" className="input"
                  form="deadline-change-form" />
              </div>
            </details>
          )}
        </form>
      )}

      {/* Muddat o'zgartirish so'rovi (alohida form) */}
      {canAskDeadline && (
        <form id="deadline-change-form" action={requestDeadlineChangeAction} className="flex gap-2 items-end">
          <input type="hidden" name="id" value={req.id} />
          <button className="btn btn-ghost">Muddat o'zgarishini so'rash (CEO ga)</button>
        </form>
      )}

      {/* CEO muddat nizosini hal qiladi */}
      {showDispute && (
        <form action={resolveDisputeAction} className="space-y-2">
          <input type="hidden" name="id" value={req.id} />
          <label className="label">Yakuniy muddat</label>
          <input name="deadline" type="date" className="input"
            defaultValue={req.suggested_deadline ?? req.deadline ?? ""} />
          <button className="btn btn-brand">Muddatni tasdiqlash → Moliyaga</button>
        </form>
      )}

      {/* AXO: menejerga topshirish (o'zi qilish o'rniga) */}
      {showDelegate && (
        <form action={delegateToManagerAction} className="space-y-2 border-t border-border pt-3">
          <input type="hidden" name="id" value={req.id} />
          <div className="text-sm text-muted">Yoki filial o'zi bajarsin:</div>
          <input name="comment" className="input" placeholder="Menejerga izoh (ixtiyoriy)" />
          <button className="btn btn-ghost">👷 Menejerga topshirish</button>
        </form>
      )}

      {/* AXO: menejer hisobotini tekshirib Moliyaga uzatish */}
      {showAxoReview && (
        <form action={axoReviewAction}>
          <input type="hidden" name="id" value={req.id} />
          <button className="btn btn-success">✓ Tekshirdim → Moliyaga uzatish</button>
        </form>
      )}

      {/* HISOBOT topshirish sahifasiga */}
      {showReport && (
        <Link href={`/requests/${req.id}/report`} className="btn btn-brand">📋 Foto-hisobot topshirish</Link>
      )}

      {/* Rad etilgandan keyin */}
      {(showReopen || showHr) && (
        <div className="flex flex-wrap gap-2">
          {showReopen && (
            <form action={reopenAction}>
              <input type="hidden" name="id" value={req.id} />
              <button className="btn btn-ghost">↺ Qayta ochish</button>
            </form>
          )}
          {showHr && (
            <form action={sendToHrAction}>
              <input type="hidden" name="id" value={req.id} />
              <button className="btn btn-ghost">HR ga yo'naltirish (oylikdan kesish)</button>
            </form>
          )}
        </div>
      )}

      {/* HR yopadi */}
      {showHrResolve && (
        <form action={hrResolveAction} className="space-y-2">
          <input type="hidden" name="id" value={req.id} />
          <input name="comment" className="input" placeholder="HR izohi (masalan: 500 000 so'm oylikdan kesildi)" />
          <button className="btn btn-success">Masalani yopish</button>
        </form>
      )}
    </div>
  );
}
