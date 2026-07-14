"use client";

import { useEffect } from "react";
import Link from "next/link";

// Route-level error boundary — server yoki render xatosida oq ekran o'rniga
// tushunarli xabar + "Qayta urinish" (reset). Barcha (app) route'lariga cascade.
export default function AppError({
  error, reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Markaziy log (client-side) — digest orqali server logi bilan bog'lanadi.
    // (Kelajakda Sentry/tashqi log ga yuboriladi.)
  }, [error]);

  return (
    <div className="max-w-md mx-auto card p-6 text-center space-y-4 mt-10">
      <div className="text-3xl">⚠️</div>
      <h1 className="text-lg font-bold">Nimadir xato ketdi</h1>
      <p className="text-sm text-muted">Sahifani yuklashda muammo bo'ldi. Iltimos, qayta urinib ko'ring.</p>
      {error.digest && <p className="text-xs text-muted">Xato kodi: {error.digest}</p>}
      <div className="flex justify-center gap-2">
        <button onClick={reset} className="btn btn-brand">Qayta urinish</button>
        <Link href="/" className="btn btn-ghost">Bosh sahifa</Link>
      </div>
    </div>
  );
}
