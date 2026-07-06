"use client";

import { useActionState } from "react";
import { createOrgAction } from "./actions";

export default function OnboardingPage() {
  const [state, action, pending] = useActionState(createOrgAction, null);
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm card p-6">
        <h1 className="text-lg font-bold mb-1">Korxonani sozlash</h1>
        <p className="text-sm text-muted mb-4">
          Davom etish uchun korxonangiz nomini kiriting.
        </p>
        <form action={action} className="space-y-4">
          <div>
            <label className="label" htmlFor="org_name">Korxona nomi</label>
            <input id="org_name" name="org_name" className="input"
              placeholder="Masalan: Zahratun fast-food" required />
          </div>
          <div>
            <label className="label" htmlFor="full_name">Sizning ismingiz</label>
            <input id="full_name" name="full_name" className="input" placeholder="Familiya Ism" required />
          </div>
          {state?.error && <p className="text-sm text-danger">{state.error}</p>}
          <button className="btn btn-brand w-full" disabled={pending}>
            {pending ? "Yaratilmoqda…" : "Davom etish"}
          </button>
        </form>
      </div>
    </div>
  );
}
