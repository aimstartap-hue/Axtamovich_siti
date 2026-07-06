"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction } from "../actions";

export default function RegisterPage() {
  const [state, action, pending] = useActionState(registerAction, null);

  return (
    <form action={action} className="space-y-4">
      <h2 className="text-lg font-semibold">Korxonani ro'yxatdan o'tkazish</h2>
      <p className="text-sm text-muted">
        Siz korxona administratori bo'lasiz. Keyin xodimlarni qo'shasiz.
      </p>

      <div>
        <label className="label" htmlFor="org_name">Korxona nomi</label>
        <input id="org_name" name="org_name" className="input"
          placeholder="Masalan: Zahratun fast-food" required />
      </div>
      <div>
        <label className="label" htmlFor="full_name">Sizning ismingiz</label>
        <input id="full_name" name="full_name" className="input"
          placeholder="Familiya Ism" required />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email"
          className="input" placeholder="siz@example.com" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Parol</label>
        <input id="password" name="password" type="password" autoComplete="new-password"
          className="input" placeholder="Kamida 6 belgi" required minLength={6} />
      </div>

      {state?.error && <p className="text-sm text-danger">{state.error}</p>}

      <button type="submit" className="btn btn-brand w-full" disabled={pending}>
        {pending ? "Yaratilmoqda…" : "Ro'yxatdan o'tish"}
      </button>

      <p className="text-sm text-muted text-center">
        Akkauntingiz bormi?{" "}
        <Link href="/login" className="text-brand font-semibold">Kirish</Link>
      </p>
    </form>
  );
}
