"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "../actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, null);

  return (
    <form action={action} className="space-y-4">
      <h2 className="text-lg font-semibold">Tizimga kirish</h2>

      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email"
          className="input" placeholder="siz@example.com" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Parol</label>
        <input id="password" name="password" type="password" autoComplete="current-password"
          className="input" placeholder="••••••••" required />
      </div>

      {state?.error && (
        <p className="text-sm text-danger">{state.error}</p>
      )}

      <button type="submit" className="btn btn-brand w-full" disabled={pending}>
        {pending ? "Kirilmoqda…" : "Kirish"}
      </button>

      <p className="text-sm text-muted text-center">
        Korxonangiz yo'qmi?{" "}
        <Link href="/register" className="text-brand font-semibold">Ro'yxatdan o'tish</Link>
      </p>
    </form>
  );
}
