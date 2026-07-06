"use client";

import { useState } from "react";
import NumberInput from "@/components/NumberInput";
import { EXPENSE_CATEGORIES, ROLES, type Role } from "@/lib/constants";

type Opt = { id: string; name: string };

/**
 * Limit qo'shish formasi — `ref` maydoni tanlangan doiraga (scope) qarab
 * o'zgaradi: kategoriya (datalist), filial/foydalanuvchi (select), rol (select).
 * Shu bilan qo'lда noto'g'ri yozib limit ishlamay qolishining oldi olinadi (punkt 5).
 */
export default function LimitForm({
  action, branches, users,
}: {
  action: (formData: FormData) => void | Promise<void>;
  branches: Opt[];
  users: Opt[];
}) {
  const [scope, setScope] = useState("category");
  const [amount, setAmount] = useState<number | null>(null);

  return (
    <details className="card p-4">
      <summary className="cursor-pointer font-medium">+ Yangi limit qo'shish</summary>
      <form action={action} className="grid md:grid-cols-2 gap-3 mt-3">
        <div>
          <label className="label">Doira</label>
          <select name="scope" className="select" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="category">Kategoriya</option>
            <option value="branch">Filial</option>
            <option value="user">Foydalanuvchi</option>
            <option value="role">Rol</option>
          </select>
        </div>

        <div>
          <label className="label">Nima uchun</label>
          {scope === "category" && (
            <>
              <input name="ref" className="input" list="cat-list" placeholder="Kategoriya nomi" />
              <datalist id="cat-list">
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c} />)}
              </datalist>
            </>
          )}
          {scope === "branch" && (
            <select name="ref" className="select">
              <option value="">— filial —</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          {scope === "user" && (
            <select name="ref" className="select">
              <option value="">— foydalanuvchi —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          {scope === "role" && (
            <select name="ref" className="select">
              <option value="">— rol —</option>
              {(Object.keys(ROLES) as Role[]).map((r) => <option key={r} value={r}>{ROLES[r]}</option>)}
            </select>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="label">Summa (so'm)</label>
          <NumberInput name="amount" value={amount} onValueChange={setAmount} placeholder="0" />
        </div>
        <button className="btn btn-brand md:col-span-2">Saqlash</button>
      </form>
    </details>
  );
}
