"use client";

import { useActionState } from "react";
import { ROLES } from "@/lib/constants";
import { inviteUser } from "./actions";

interface Branch { id: number; name: string; }

export default function InviteUser({ branches }: { branches: Branch[] }) {
  const [state, action, pending] = useActionState(inviteUser, null);
  return (
    <details className="border border-border rounded-lg p-3">
      <summary className="cursor-pointer font-medium text-sm">+ Yangi xodim qo'shish</summary>
      <form action={action} className="grid md:grid-cols-2 gap-3 mt-3">
        <input name="full_name" className="input" placeholder="Familiya Ism" required />
        <input name="email" type="email" className="input" placeholder="email@example.com" required />
        <input name="password" type="text" className="input" placeholder="Boshlang'ich parol" required />
        <select name="role" className="select" defaultValue="branch_manager">
          {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="branch_id" className="select md:col-span-2">
          <option value="">— filial (menejer uchun) —</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        {state?.error && <p className="text-sm text-danger md:col-span-2">{state.error}</p>}
        {state?.ok && <p className="text-sm text-success md:col-span-2">{state.message}</p>}
        <button className="btn btn-brand md:col-span-2" disabled={pending}>
          {pending ? "Qo'shilmoqda…" : "Xodimni qo'shish"}
        </button>
      </form>
    </details>
  );
}
