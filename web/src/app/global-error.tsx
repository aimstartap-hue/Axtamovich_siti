"use client";

// Root-level error boundary — hatto root layout yiqilsa ham oq ekran bo'lmaydi.
// global-error o'z <html>/<body> ini render qilishi shart.
export default function GlobalError({
  error, reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="uz">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", textAlign: "center", color: "#14181f" }}>
        <div style={{ maxWidth: 420, margin: "3rem auto" }}>
          <div style={{ fontSize: "2rem" }}>⚠️</div>
          <h1 style={{ fontSize: "1.2rem", fontWeight: 700 }}>Tizimda xatolik</h1>
          <p style={{ color: "#6b7280", fontSize: ".9rem" }}>Iltimos, sahifani yangilang yoki keyinroq urinib ko'ring.</p>
          {error.digest && <p style={{ color: "#6b7280", fontSize: ".75rem" }}>Xato kodi: {error.digest}</p>}
          <button onClick={reset} style={{ marginTop: "1rem", padding: ".6rem 1rem", borderRadius: 10, border: "none", background: "#2563eb", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
            Qayta urinish
          </button>
        </div>
      </body>
    </html>
  );
}
