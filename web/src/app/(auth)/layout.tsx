export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand text-brand-fg text-2xl font-bold mb-3">
            AX
          </div>
          <h1 className="text-xl font-bold">AXO-OPEN group</h1>
          <p className="text-sm text-muted">AXO boshqaruv tizimi</p>
        </div>
        <div className="card p-6">{children}</div>
      </div>
    </div>
  );
}
