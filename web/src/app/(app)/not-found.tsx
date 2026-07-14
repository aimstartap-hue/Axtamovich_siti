import Link from "next/link";

// notFound() chaqirilganda (masalan mavjud bo'lmagan zayavka) — Shell ichida
// tushunarli sahifa (404 oq ekran o'rniga).
export default function NotFound() {
  return (
    <div className="max-w-md mx-auto card p-6 text-center space-y-4 mt-10">
      <div className="text-3xl">🔎</div>
      <h1 className="text-lg font-bold">Topilmadi</h1>
      <p className="text-sm text-muted">Bu sahifa yoki yozuv mavjud emas yoki sizga ruxsat yo'q.</p>
      <Link href="/" className="btn btn-brand">Bosh sahifa</Link>
    </div>
  );
}
